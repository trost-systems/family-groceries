import 'dart:async';

import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/add_sheet/add_sheet.dart';
import 'package:family_groceries/list/add_sheet/add_sheet_cubit.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/dictation.dart';
import 'package:family_groceries/list/dictation_button.dart';
import 'package:family_groceries/list/list_cubit.dart';
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

/// The List tab: the household's name and count on top, the list, and the
/// add bar at the bottom, which opens the add sheet. Needs the list scope
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
    return ShoppingList(household: session.household, dictation: _dictation);
  }
}

/// The tab's content for [household]; needs a [ListCubit] above it.
class const ShoppingList({
  required final Household household,

  /// Null hides the microphone button.
  final Dictation? dictation,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (context) => AddSheetCubit(context.read<ListCubit>()),
    // The list's snackbars float above the add bar, not above the tabs.
    child: ScaffoldMessenger(
      child: _ShoppingList(household: household, dictation: dictation),
    ),
  );
}

class const _ShoppingList({
  required final Household household,
  required final Dictation? dictation,
}) extends StatefulWidget {
  @override
  State<_ShoppingList> createState() => _ShoppingListState();
}

class _ShoppingListState() extends State<_ShoppingList> {
  final _input = TextEditingController();
  final _inputFocus = FocusNode();
  RejectionNotices? _notices;
  SheetOpenNotifier? _sheetOpen;
  var _listening = false;

  /// Phones get the keyboard only when asked; with a hardware keyboard
  /// the field is ready for typing at once.
  static final _autofocus =
      defaultTargetPlatform != TargetPlatform.iOS &&
      defaultTargetPlatform != TargetPlatform.android;

  @override
  void initState() {
    super.initState();
    _notices = context.read<RejectionNotices?>()?..listTab = _rejected;
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
    _sheetOpen?.removeListener(_followShell);
    // The tabs come back, after this frame: the tree is locked now, and a
    // new household's list may already have taken the notifier over.
    if (_sheetOpen case final notifier? when notifier.value) {
      WidgetsBinding.instance.addPostFrameCallback((_) => notifier.release());
    }
    if (_notices?.listTab == _rejected) {
      _notices?.listTab = null;
    }
    _input.dispose();
    _inputFocus.dispose();
    super.dispose();
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
  /// while ticking things off in the store. A tick commits 260 ms after
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
        BlocListener<AddSheetCubit, AddSheetState>(
          listenWhen: (a, b) => a.open != b.open,
          listener: (_, sheet) => _sheetOpen?.value = sheet.open,
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
                      _Header(widget.household),
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
                  onDone: _inputFocus.requestFocus,
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
    return Material(
      color: scheme.surfaceContainerLow,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: open ? Colors.transparent : scheme.outlineVariant,
            ),
          ),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: addBarHeight,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: addSheetMaxWidth),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 10, 0),
                  child: Row(
                    spacing: 10,
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
                              maxLengthEnforcement:
                                  MaxLengthEnforcement.enforced,
                              textInputAction: TextInputAction.send,
                              textCapitalization: TextCapitalization.sentences,
                              style: TextStyle(
                                fontSize: 18,
                                color: scheme.onSurface,
                              ),
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
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "+" while closed; open, the first row's icon, popping in.
class const _Disc({required final bool open, required final String? icon})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final still = MediaQuery.disableAnimationsOf(context);
    final Widget face = !open
        ? Icon(Icons.add, size: 24, color: scheme.onPrimary)
        : icon == null
        ? Icon(Icons.search, size: 20, color: scheme.onSecondaryContainer)
        : Text(icon!, style: const TextStyle(fontSize: 20));
    return ExcludeSemantics(
      child: AnimatedSwitcher(
        duration: still ? Duration.zero : const Duration(milliseconds: 220),
        switchInCurve: Easing.emphasizedDecelerate,
        transitionBuilder: (child, animation) => ScaleTransition(
          scale: Tween<double>(begin: 0.6, end: 1).animate(animation),
          child: child,
        ),
        layoutBuilder: (current, previous) =>
            Stack(alignment: Alignment.center, children: [?current]),
        child: Container(
          key: ValueKey((open, icon)),
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: open ? scheme.secondaryContainer : scheme.primary,
          ),
          child: face,
        ),
      ),
    );
  }
}

/// The household's name (Hummlist without one), the item count, how many
/// partner adds are new, and the sync state.
class const _Header(final Household household) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final cubit = context.watch<ListCubit>();
    final state = cubit.state;
    final count = state.items.values
        .where((i) => i.status == ItemStatus.active)
        .length;
    final fresh = cubit.fresh;
    final by = {for (final id in fresh) state.items[id]?.addedBy};
    final partner = by.length == 1 ? state.catalog.member(by.single) : null;
    final name = household.name.trim().isEmpty ? l10n.appTitle : household.name;
    final small = TextStyle(fontSize: 13, color: scheme.onSurfaceVariant);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          MediaQuery.paddingOf(context).top + 6,
          8,
          8,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      name.toUpperCase(),
                      key: const ValueKey('list-title'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 13 * 0.08,
                        color: scheme.primary,
                      ),
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    children: [
                      Text(
                        l10n.listItemCount(count),
                        key: const ValueKey('list-count'),
                        style: small,
                      ),
                      if (fresh.isNotEmpty)
                        Text(
                          partner == null
                              ? l10n.newItems(fresh.length)
                              : l10n.newItemsFrom(
                                  fresh.length,
                                  partner.displayName,
                                ),
                          key: const ValueKey('new-items-subtitle'),
                          style: small.copyWith(
                            color: scheme.tertiary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const _SyncIndicator(),
          ],
        ),
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
        child: Padding(
          padding: const EdgeInsets.all(12),
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
