import 'dart:async';

import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/design/hex_border.dart';
import 'package:family_groceries/design/motion.dart';
import 'package:family_groceries/design/pointy_hex.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/home_widget/widget_launch.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/add_sheet/add_sheet.dart';
import 'package:family_groceries/list/add_sheet/add_sheet_cubit.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/dictation.dart';
import 'package:family_groceries/list/dictation_button.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_link.dart';
import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/list_scope.dart';
import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/list_view/shopping_list_view.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// The List tab: a status bar on top, the list, and the add bar at the
/// bottom, which opens the add sheet. Needs the list scope
/// (`ListScope`) above it.
class const ListScreen({super.key}) extends StatelessWidget {
  static final Dictation? _dictation = dictationFor(
    defaultTargetPlatform,
    web: kIsWeb,
  );

  /// Only iOS and Android recognize speech on the device; elsewhere typing
  /// is the way in.
  @visibleForTesting
  static Dictation? dictationFor(
    TargetPlatform platform, {
    required bool web,
  }) =>
      !web &&
          (platform == TargetPlatform.iOS || platform == TargetPlatform.android)
      ? DeviceDictation()
      : null;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is! InHousehold) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return ShoppingList(dictation: _dictation);
  }
}

/// The tab's content; needs a [ListCubit] above it.
class const ShoppingList({
  /// Null hides the microphone button.
  final Dictation? dictation,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (context) => AddSheetCubit(context.read<ListCubit>()),
    // The list's snackbars float above the add bar, not above the tabs.
    child: ScaffoldMessenger(child: _ShoppingList(dictation: dictation)),
  );
}

class const _ShoppingList({required final Dictation? dictation})
    extends StatefulWidget {
  @override
  State<_ShoppingList> createState() => _ShoppingListState();
}

class _ShoppingListState() extends State<_ShoppingList> {
  final _input = TextEditingController();
  final _inputFocus = FocusNode();
  RejectionNotices? _notices;
  SheetOpenNotifier? _sheetOpen;
  AddSheetRequest? _addSheetRequest;
  ListLinks? _links;
  StreamSubscription<DedupeHint>? _hints;

  /// The duplicate hint on screen, until it closes.
  (DedupeHint, ScaffoldFeatureController<SnackBar, SnackBarClosedReason>)?
  _openHint;
  var _listening = false;

  /// Set when the user closes the sheet: the field's next focus is the user
  /// coming back to type, and opens the sheet. On the web a click can reach
  /// the field as a semantics tap or focus, which never calls
  /// `TextField.onTap`. Not set by a tap on the list: after one, the field
  /// can get focus back without a tap (fg sync's sign-in, job 52).
  var _openOnFocus = false;

  /// Phones get the keyboard only when asked; with a hardware keyboard
  /// the field is ready for typing at once.
  static final _autofocus =
      defaultTargetPlatform != TargetPlatform.iOS &&
      defaultTargetPlatform != TargetPlatform.android;

  @override
  void initState() {
    super.initState();
    _notices = context.read<RejectionNotices?>()?..listTab = _rejected;
    _hints = context.read<ListCubit>().hints.listen(_hint);
    _inputFocus.addListener(_focusChanged);
    _addSheetRequest = context.read<AddSheetRequest?>()
      ?..listTab = _openRequested;
    // A widget's Add that started the app came before this tab.
    WidgetsBinding.instance.addPostFrameCallback((_) => _openRequested());
    _links = context.read<ListLinks?>()?..changes.addListener(_linked);
    // A cold start's `/add` came before this list was built.
    _linked();
  }

  /// A Home Screen widget's Add: the sheet opens, ready for typing.
  void _openRequested() {
    if (mounted && (_addSheetRequest?.take() ?? false)) {
      context.read<AddSheetCubit>().show();
      _inputFocus.requestFocus();
    }
  }

  /// An `/add` link opens the sheet with the field focused. After the
  /// frame: the router asks during its own work, the tab may still be
  /// switching to the list.
  void _linked() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _links?.take<AddLink>() != null) {
        _openOnFocus = false;
        context.read<AddSheetCubit>().show();
        _inputFocus.requestFocus();
      }
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _focusChanged() {
    if (_inputFocus.hasFocus && _openOnFocus) {
      _openOnFocus = false;
      context.read<AddSheetCubit>().show();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final notifier = SheetOpen.maybeOf(context);
    if (notifier != _sheetOpen) {
      _sheetOpen?.removeListener(_followShell);
      _sheetOpen = notifier?..addListener(_followShell);
    }
  }

  /// The shell closes the sheet when the user leaves the tab.
  void _followShell() {
    if (_sheetOpen?.value == false) {
      context.read<AddSheetCubit>().dismiss();
    }
  }

  @override
  void dispose() {
    _links?.changes.removeListener(_linked);
    _sheetOpen?.removeListener(_followShell);
    if (_addSheetRequest?.listTab == _openRequested) {
      _addSheetRequest?.listTab = null;
    }
    // The tabs come back, after this frame: the tree is locked now, and a
    // new household's list may already have taken the notifier over.
    if (_sheetOpen case final notifier? when notifier.value) {
      WidgetsBinding.instance.addPostFrameCallback((_) => notifier.release());
    }
    if (_notices?.listTab == _rejected) {
      _notices?.listTab = null;
    }
    unawaited(_hints?.cancel());
    _input.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  /// Job 32b: "Möhren steht schon auf der Liste" with Zusammenführen, after
  /// "Karotten" went on the list anyway. While the add sheet is open it is
  /// part of the sheet's note (a snackbar would cover the sheet); otherwise,
  /// and once the sheet closes, a snackbar. That queues behind one already
  /// showing (a dictation summary) instead of cutting it short. Every hint
  /// shown ends merged or ignored, once; [counted] when the sheet showed it
  /// already.
  void _hint(DedupeHint hint, {bool counted = false}) {
    if (!mounted) {
      return;
    }
    if (!counted && context.read<AddSheetCubit>().offer(hint)) {
      return;
    }
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ListCubit>();
    if (!counted) {
      cubit.hintShown();
    }
    var merged = false;
    final shown = ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        key: const ValueKey('dedupe-hint'),
        content: Text(l10n.alreadyOnList(hint.onList.name)),
        persist: false,
        duration: const Duration(seconds: 6),
        action: SnackBarAction(
          key: const ValueKey('dedupe-merge'),
          label: l10n.dedupeMerge,
          onPressed: () {
            merged = true;
            // Closing on its own now; `close` would hit the next snackbar.
            _openHint = null;
            if (mounted) {
              _showMerged(context.read<ListCubit>().merge(hint));
            }
          },
        ),
      ),
    );
    _openHint = (hint, shown);
    unawaited(
      shown.closed.then((_) {
        if (_openHint?.$2 == shown) {
          _openHint = null;
        }
        if (!merged) {
          cubit.hintIgnored();
        }
      }),
    );
  }

  /// Says what the open item holds after [merge], with Rückgängig. The
  /// action closes the hint itself, after this: hiding it here too would,
  /// with animations off (screen readers, the web's semantics), close the
  /// new snackbar instead.
  void _showMerged(Merge? merge) {
    if (!mounted || merge == null) {
      return;
    }
    final cubit = context.read<ListCubit>();
    final result = merge.result;
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        key: const ValueKey('dedupe-merged'),
        content: Text(
          l10n.dedupeMerged([?result.quantity, result.name].join(' ')),
        ),
        persist: false,
        action: SnackBarAction(
          key: const ValueKey('dedupe-undo'),
          label: l10n.undo,
          onPressed: () => cubit.unmerge(merge),
        ),
      ),
    );
  }

  /// A refused write, in the list's own messenger while the list is on
  /// screen; false sends it to the app's (More, screens opened on top).
  bool _rejected(String text) {
    if (!mounted ||
        !TickerMode.valuesOf(context).enabled ||
        !(ModalRoute.of(context)?.isCurrent ?? true)) {
      return false;
    }
    _snack(text);
    return true;
  }

  void _snack(String text) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), persist: false));

  void _close() {
    context.read<AddSheetCubit>().dismiss();
    _inputFocus.unfocus();
    _openOnFocus = true;
  }

  void _take(Suggestion suggestion) {
    _afterAdd(context.read<AddSheetCubit>().take(suggestion));
    _refocusAfterTap();
  }

  Future<void> _submit() async {
    _afterAdd(await context.read<AddSheetCubit>().takeFirst());
  }

  void _afterAdd(AddResult? result) {
    if (!mounted || result == null || result is NothingToAdd) {
      return;
    }
    _input.clear();
    _inputFocus.requestFocus();
  }

  /// On web a tap outside the field blurs its DOM input while Flutter keeps
  /// the field focused, so requestFocus does nothing. A fresh focus gives the
  /// input back; it waits for the engine's deferred blur of the closed
  /// connection (a zero-delay timer) to run first, or that blur wins.
  void _refocusAfterTap() {
    if (!kIsWeb) {
      _inputFocus.requestFocus();
      return;
    }
    _inputFocus.unfocus();
    Timer(const Duration(milliseconds: 50), () {
      if (mounted) {
        _inputFocus.requestFocus();
      }
    });
  }

  /// Acting on the list ends typing, which also drops the soft keyboard
  /// while ticking things off in the store. A tick commits 440 ms after
  /// the tap; by then the user may have opened the sheet to type, and the
  /// late call must not take the field away.
  void _leaveField() {
    if (!context.read<AddSheetCubit>().state.open) {
      _inputFocus.unfocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = context.select<AddSheetCubit, bool>((c) => c.state.open);
    final media = MediaQuery.of(context);
    // The tabs below the bar: the band the open sheet stands on.
    final tabs = media.size.width >= wideLayout ? 0.0 : 62.0;
    return MultiBlocListener(
      listeners: [
        // A hint whose items are no longer both open (the add undone, a
        // partner ticked one) has nothing left to merge: it goes.
        BlocListener<ListCubit, ListState>(
          listenWhen: (a, b) =>
              !identical(a.server, b.server) ||
              !identical(a.pending, b.pending),
          listener: (context, list) {
            final items = list.items;
            bool stale(DedupeHint hint) => [
              hint.added,
              hint.onList,
            ].any((i) => items[i.id]?.status != ItemStatus.active);
            if (_openHint case (final hint, final bar) when stale(hint)) {
              bar.close();
            }
            final sheet = context.read<AddSheetCubit>();
            if (sheet.state.hint case final hint? when stale(hint)) {
              sheet.drop(hint);
            }
          },
        ),
        BlocListener<AddSheetCubit, AddSheetState>(
          listenWhen: (a, b) => a.open != b.open,
          listener: (_, sheet) => _sheetOpen?.value = sheet.open,
        ),
        // A hint or merge in the closing sheet's note goes on as a snackbar.
        BlocListener<AddSheetCubit, AddSheetState>(
          listenWhen: (a, b) => a.open && !b.open,
          listener: (context, _) {
            final (hint, merge) = context.read<AddSheetCubit>().handOver();
            if (merge != null) {
              _showMerged(merge);
            } else if (hint != null) {
              _hint(hint, counted: true);
            }
          },
        ),
        // A sheet that starts over (closed, or opened again) clears the
        // input too.
        BlocListener<AddSheetCubit, AddSheetState>(
          listenWhen: (a, b) => b.text.isEmpty && a.text.isNotEmpty,
          listener: (_, _) {
            if (_input.text.isNotEmpty) {
              _input.clear();
            }
          },
        ),
      ],
      // Tab goes input, suggestions, chips, Schließen, then the bar's
      // buttons (DECISIONS, Job 17).
      child: FocusTraversalGroup(
        policy: OrderedTraversalPolicy(),
        child: Scaffold(
          // The shell's scaffold makes room for the keyboard.
          resizeToAvoidBottomInset: false,
          body: Stack(
            children: [
              ExcludeFocus(
                excluding: open,
                child: ExcludeSemantics(
                  excluding: open,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _Header(),
                      Expanded(
                        child: ShoppingListView(
                          bottomInset: addBarHeight,
                          onInteract: _leaveField,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned.fill(
                child: TextFieldTapRegion(
                  child: AddSheet(
                    onTake: _take,
                    onClose: _close,
                    onPicked: _refocusAfterTap,
                    bandHeight: addBarHeight + tabs + media.padding.bottom,
                  ),
                ),
              ),
            ],
          ),
          bottomNavigationBar: TextFieldTapRegion(
            child: _AddBar(
              input: _input,
              focus: _inputFocus,
              autofocus: _autofocus,
              listening: _listening,
              onSubmit: () => unawaited(_submit()),
              onClose: _close,
              onLeave: _leaveField,
              dictation: switch (widget.dictation) {
                final dictation? => DictationButton(
                  dictation: dictation,
                  input: _input,
                  onMessage: _snack,
                  onListening: (listening) =>
                      setState(() => _listening = listening),
                  // The dictated text waits in the field; a tap opens it.
                  onDone: () {
                    _openOnFocus = false;
                    _inputFocus.requestFocus();
                  },
                ),
                null => null,
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// The input, in the thumb zone: the leading disc, the field, clear while
/// the sheet is open, and the microphone. It never moves while the sheet
/// opens, grows or closes.
class const _AddBar({
  required final TextEditingController input,
  required final FocusNode focus,
  required final bool autofocus,
  required final bool listening,
  required final VoidCallback onSubmit,
  required final VoidCallback onClose,
  required final VoidCallback onLeave,
  required final Widget? dictation,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final cubit = context.read<AddSheetCubit>();
    final sheet = context.watch<AddSheetCubit>().state;
    final list = context.watch<ListCubit>();
    final open = sheet.open;
    final first = sheetRows(sheet, list).firstOrNull?.entry;
    final t = HummlistColors.of(Theme.of(context).brightness);
    // The hex is the container's, never the field's: an InputBorder on the
    // field changes its padding when focused (DECISIONS, Job 52 item 7).
    final compose = Container(
      height: _composeHeight,
      padding: const EdgeInsets.symmetric(
        horizontal: HlHex.tip * _composeHeight - HlSpace.s1,
      ),
      decoration: ShapeDecoration(
        color: t.surfaceRaised,
        shape: HexBorder(
          side: BorderSide(color: t.border, width: HlBorder.width),
        ),
      ),
      child: Row(
        spacing: HlSpace.s2,
        children: [
          _Disc(
            open: open,
            icon: first == null
                ? null
                : nameIcon(
                    first.name,
                    list.state.catalog.categories
                        .where((c) => c.id == first.categoryId)
                        .firstOrNull,
                  ),
          ),
          Expanded(
            child: Focus(
              // Hardware Enter (web, desktop) is handled here,
              // because Flutter web's text-input action path
              // blurs the field and leaves it dead for the next
              // Enter. Soft keyboards still submit below.
              onKeyEvent: (_, event) {
                final key = event.logicalKey;
                final enter =
                    key == LogicalKeyboardKey.enter ||
                    key == LogicalKeyboardKey.numpadEnter;
                if (event is KeyUpEvent) {
                  return KeyEventResult.ignored;
                }
                if (key == LogicalKeyboardKey.escape && open) {
                  onClose();
                  return KeyEventResult.handled;
                }
                if (!enter) {
                  return KeyEventResult.ignored;
                }
                if (event is KeyDownEvent) {
                  onSubmit();
                }
                return KeyEventResult.handled;
              },
              child: FocusTraversalOrder(
                order: const NumericFocusOrder(1),
                // The bar around it draws the hex; the app's field theme
                // must not reach this field (DECISIONS job 52, item 7).
                child: InputDecorationTheme(
                  data: const InputDecorationThemeData(),
                  child: TextField(
                    key: const ValueKey('add-item-field'),
                    controller: input,
                    focusNode: focus,
                    autofocus: autofocus,
                    // Focus comes back after every tap in the
                    // sheet; typing goes on where it was.
                    selectAllOnFocus: false,
                    // The server caps names at 120 characters.
                    maxLength: 120,
                    maxLengthEnforcement: MaxLengthEnforcement.enforced,
                    textInputAction: TextInputAction.send,
                    textCapitalization: TextCapitalization.sentences,
                    style: TextStyle(fontSize: 18, color: scheme.onSurface),
                    decoration: InputDecoration(
                      hintText: listening
                          ? l10n.dictationListening
                          : l10n.addFieldHint,
                      hintStyle: TextStyle(
                        fontSize: 18,
                        color: scheme.onSurfaceVariant,
                      ),
                      border: InputBorder.none,
                      counterText: '',
                    ),
                    onTap: () {
                      cubit.show();
                      // Text the microphone left behind.
                      if (input.text.isNotEmpty) {
                        cubit.type(input.text);
                      }
                    },
                    onChanged: cubit.type,
                    // Keeps the soft keyboard up after submitting.
                    onEditingComplete: () {},
                    onSubmitted: (_) => onSubmit(),
                    onTapOutside: (_) {
                      if (!open) {
                        onLeave();
                      }
                    },
                  ),
                ),
              ),
            ),
          ),
          if (open && sheet.text.isNotEmpty)
            FocusTraversalOrder(
              order: const NumericFocusOrder(5),
              child: IconButton(
                key: const ValueKey('add-clear'),
                tooltip: l10n.clearInput,
                icon: const Icon(Icons.close),
                onPressed: () {
                  input.clear();
                  cubit.type('');
                  focus.requestFocus();
                },
              ),
            ),
          if (dictation case final dictation?)
            FocusTraversalOrder(
              order: const NumericFocusOrder(6),
              child: dictation,
            ),
        ],
      ),
    );
    // In the list's first column, where the sheet opens. Closed, the bar is
    // the page under the field; open, it carries on the sheet above it.
    return ColoredBox(
      color: t.surface,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final frame = ShoppingListView.frameFor(
            constraints.maxWidth,
            list.state,
          );
          return Padding(
            padding: EdgeInsetsDirectional.only(start: frame.side),
            child: Align(
              alignment: AlignmentDirectional.topStart,
              heightFactor: 1,
              child: AnimatedContainer(
                width: frame.columnWidth,
                duration: hlMotion(context, HlDuration.short),
                curve: HlEasing.standard,
                color: open ? t.surfaceRaised : t.surface,
                child: SafeArea(
                  top: false,
                  child: Container(
                    height: addBarHeight,
                    padding: const EdgeInsets.symmetric(horizontal: HlSpace.s3),
                    alignment: Alignment.center,
                    child: compose,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// The compose field's height: the site's `.compose`.
const _composeHeight = 52.0;

/// "+" on lemon while closed; open, the first row's icon, popping in.
class const _Disc({required final bool open, required final String? icon})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    final Widget face = !open
        ? Icon(Icons.add, size: 22, color: t.onHoney)
        : icon == null
        ? Icon(Icons.search, size: 18, color: t.text)
        : Text(icon!, style: const TextStyle(fontSize: 18));
    return ExcludeSemantics(
      child: AnimatedSwitcher(
        duration: hlMotion(context, HlDuration.short),
        switchInCurve: HlEasing.standard,
        transitionBuilder: (child, animation) => ScaleTransition(
          scale: Tween<double>(begin: 0.6, end: 1).animate(animation),
          child: child,
        ),
        layoutBuilder: (current, previous) =>
            Stack(alignment: Alignment.center, children: [?current]),
        child: PointyHex(
          key: ValueKey((open, icon)),
          face: open ? t.honeySoft : t.honey,
          size: 38,
          child: face,
        ),
      ),
    );
  }
}

/// The bar above the list: how many partner adds are new, and the sync
/// state; no household name and no count (Peter, DECISIONS Job 29a). It is
/// [height] tall in every state, so the list below never moves when either
/// comes or goes. It sits in the list's frame (job 57).
class const _Header() extends StatelessWidget {
  /// Below the top safe area; also the sync icon's square tap target.
  static const height = 44.0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = HummlistColors.of(Theme.of(context).brightness);
    final cubit = context.watch<ListCubit>();
    final state = cubit.state;
    final fresh = cubit.fresh;
    final by = {for (final id in fresh) state.items[id]?.addedBy};
    final partner = by.length == 1 ? state.catalog.member(by.single) : null;
    return DecoratedBox(
      key: const ValueKey('list-header'),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: t.divider)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final side = ShoppingListView.frameFor(
            constraints.maxWidth,
            state,
          ).side;
          return Padding(
            padding: EdgeInsets.only(
              left: side + HlSpace.s4 + HlSpace.s1,
              top: MediaQuery.paddingOf(context).top,
              right: side + HlSpace.s2,
            ),
            child: SizedBox(
              height: height,
              child: Row(
                children: [
                  Expanded(
                    child: fresh.isEmpty
                        ? const SizedBox.shrink()
                        : Text(
                            partner == null
                                ? l10n.newItems(fresh.length)
                                : l10n.newItemsFrom(
                                    fresh.length,
                                    partner.displayName,
                                  ),
                            key: const ValueKey('new-items-subtitle'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: t.success,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                  const SizedBox.square(
                    dimension: height,
                    child: _SyncIndicator(),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class const _SyncIndicator() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (connection, pending) = context
        .select<ListCubit, (ConnectionStatus, int)>(
          (c) => (c.state.connection, c.state.pending.length),
        );
    final message = switch ((connection, pending)) {
      (ConnectionStatus.offline, _) => l10n.offline,
      (_, > 0) => l10n.pendingChanges(pending),
      _ => null,
    };
    if (message != null) {
      return Tooltip(
        message: message,
        excludeFromSemantics: true,
        child: Center(
          child: Icon(
            connection == ConnectionStatus.offline
                ? Icons.cloud_off
                : Icons.cloud_upload_outlined,
            semanticLabel: message,
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}
