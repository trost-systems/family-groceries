import 'dart:async';

import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/household/invite_dialog.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/categories_screen.dart';
import 'package:family_groceries/list/dictation.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/list_view/shopping_list_view.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// The whole app for day-to-day use: add field on top, list beneath.
class const ListScreen({
  super.key,

  /// Overrides the Supabase repository, for tests.
  final ListRepository? repository,
}) extends StatelessWidget {
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
    final household = session.household;
    return BlocProvider(
      key: ValueKey(household.id),
      create: (context) => ListCubit(
        repository ??
            SupabaseListRepository(Supabase.instance.client, household.id),
        context.read<DeviceCache>().list(session.userId, household.id),
        userId: session.userId,
      )..start(),
      child: ShoppingList(household: household, dictation: _dictation),
    );
  }
}

class const ShoppingList({
  required final Household household,

  /// Null hides the microphone button.
  final Dictation? dictation,
  super.key,
}) extends StatefulWidget {
  @override
  State<ShoppingList> createState() => _ShoppingListState();
}

class _ShoppingListState() extends State<ShoppingList> {
  final _input = TextEditingController();
  final _inputFocus = FocusNode();
  late final AppLifecycleListener _lifecycle;
  late final StreamSubscription<Rejected> _rejections;
  var _listening = false;

  @override
  void initState() {
    super.initState();
    final cubit = context.read<ListCubit>();
    _lifecycle = AppLifecycleListener(
      onResume: () => unawaited(cubit.resync()),
    );
    _rejections = cubit.rejections.listen((rejection) {
      if (!mounted) {
        return;
      }
      final l10n = AppLocalizations.of(context);
      _snack(switch (rejection) {
        ItemRejected(:final itemName) => l10n.syncFailed(itemName),
        NameTaken(:final name) => l10n.categoryNameTaken(name),
        CatalogRejected() => l10n.catalogSaveFailed,
        NeedsConnection() => l10n.reorderNeedsConnection,
      });
    });
  }

  @override
  void dispose() {
    unawaited(_rejections.cancel());
    _lifecycle.dispose();
    _input.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  void _snack(String text, {VoidCallback? undo}) {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(text),
          persist: false,
          action: undo == null
              ? null
              : SnackBarAction(label: l10n.undo, onPressed: undo),
        ),
      );
  }

  void _submit() => _afterAdd(context.read<ListCubit>().add(_input.text));

  void _addUsual(Usual usual) {
    _afterAdd(context.read<ListCubit>().addUsual(usual));
    _refocusAfterTap();
  }

  /// On web a tap outside the field blurs its DOM input while Flutter keeps
  /// the field focused, so requestFocus does nothing. A fresh focus gives the
  /// input back; it waits for the engine's deferred blur of the closed
  /// connection (a zero-delay timer) to run first, or that blur wins.
  void _refocusAfterTap() {
    if (!kIsWeb) {
      return;
    }
    _inputFocus.unfocus();
    Timer(const Duration(milliseconds: 50), () {
      if (mounted) {
        _inputFocus.requestFocus();
      }
    });
  }

  void _afterAdd(AddResult result) {
    final l10n = AppLocalizations.of(context);
    switch (result) {
      case Added():
        _input.clear();
      case AlreadyOnList(:final item):
        _input.clear();
        _snack(l10n.alreadyOnList(item.name));
      case NothingToAdd():
        break;
    }
    _inputFocus.requestFocus();
  }

  /// Fills the field while the user speaks, then adds what the server's
  /// splitter makes of the sentence. On failure the text stays in the field.
  Future<void> _dictate(Dictation dictation) async {
    if (_listening) {
      await dictation.stop();
      return;
    }
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<ListCubit>();
    if (await dictation.prepare() case final problem?) {
      if (mounted) {
        _snack(_dictationProblem(l10n, problem));
      }
      return;
    }
    setState(() => _listening = true);
    final dictated = await dictation.listen(
      onWords: (words) => _input.text = words,
    );
    if (!mounted) {
      return;
    }
    setState(() => _listening = false);
    final String text;
    switch (dictated) {
      case Heard(text: final heard):
        text = heard;
      case NothingHeard():
        _snack(l10n.dictationNothingHeard);
        return;
      case Refused(:final problem):
        _snack(_dictationProblem(l10n, problem));
        return;
    }
    try {
      final results = await cubit.addSpoken(text);
      if (!mounted) {
        return;
      }
      if (results.isEmpty) {
        _snack(l10n.dictationNothingUnderstood);
      } else {
        _input.clear();
        _snack(_dictationSummary(l10n, results));
      }
    } on Exception {
      if (mounted) {
        _snack(l10n.dictationSplitFailed);
      }
    }
    _inputFocus.requestFocus();
  }

  static String _dictationProblem(
    AppLocalizations l10n,
    DictationProblem problem,
  ) => switch (problem) {
    DictationProblem.unavailable => l10n.dictationUnavailable,
    DictationProblem.noOfflineGerman => l10n.dictationNoOfflineGerman,
  };

  static String _dictationSummary(
    AppLocalizations l10n,
    List<AddResult> results,
  ) {
    final added = [
      for (final result in results)
        if (result case Added(:final item))
          [?item.quantity, item.name].join(' '),
    ];
    final existing = [
      for (final result in results)
        if (result case AlreadyOnList(:final item)) item.name,
    ];
    return [
      if (added.isNotEmpty) l10n.dictationAdded(added.join(', ')),
      if (existing.isNotEmpty) l10n.dictationAlreadyOnList(existing.join(', ')),
    ].join(' ');
  }

  /// Acting on the list ends typing, which also drops the soft keyboard
  /// while ticking things off in the store.
  void _leaveField() => _inputFocus.unfocus();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: _Title(widget.household.name),
        actions: [
          const _SyncIndicator(),
          _Menu(household: widget.household),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Focus(
              // Hardware Enter (web, desktop): handled here, because Flutter
              // web's text-input action path blurs the field and leaves it
              // dead for the next Enter. Soft keyboards still submit below.
              onKeyEvent: (_, event) {
                final enter =
                    event.logicalKey == LogicalKeyboardKey.enter ||
                    event.logicalKey == LogicalKeyboardKey.numpadEnter;
                if (!enter || event is KeyUpEvent) {
                  return KeyEventResult.ignored;
                }
                if (event is KeyDownEvent) {
                  _submit();
                }
                return KeyEventResult.handled;
              },
              child: TextField(
                key: const ValueKey('add-item-field'),
                controller: _input,
                focusNode: _inputFocus,
                autofocus: true,
                // The server caps names at 120 characters.
                maxLength: 120,
                maxLengthEnforcement: MaxLengthEnforcement.enforced,
                textInputAction: TextInputAction.send,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: _listening
                      ? l10n.dictationListening
                      : l10n.addFieldHint,
                  prefixIcon: const Icon(Icons.add_shopping_cart),
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.dictation case final dictation?)
                        IconButton(
                          key: const ValueKey('dictation-button'),
                          tooltip: _listening
                              ? l10n.dictationStop
                              : l10n.dictationStart,
                          icon: Icon(
                            _listening ? Icons.stop_circle : Icons.mic,
                          ),
                          color: _listening
                              ? Theme.of(context).colorScheme.error
                              : null,
                          onPressed: () => unawaited(_dictate(dictation)),
                        ),
                      IconButton(
                        tooltip: l10n.addButton,
                        icon: const Icon(Icons.send),
                        onPressed: () {
                          _submit();
                          _refocusAfterTap();
                        },
                      ),
                    ],
                  ),
                  border: const OutlineInputBorder(),
                  counterText: '',
                ),
                // Keeps the soft keyboard up after submitting.
                onEditingComplete: () {},
                onTapOutside: (_) => _leaveField(),
                onSubmitted: (_) => _submit(),
              ),
            ),
          ),
          // Tapping a chip neither takes focus nor counts as a tap outside
          // the field, so typing goes on.
          ExcludeFocus(
            child: TextFieldTapRegion(
              child: ValueListenableBuilder(
                valueListenable: _input,
                builder: (context, value, _) =>
                    _UsualChips(text: value.text, onTap: _addUsual),
              ),
            ),
          ),
          Expanded(child: ShoppingListView(onInteract: _leaveField)),
        ],
      ),
    );
  }
}

/// The household's name, and how many partner adds are new.
class const _Title(final String household) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<ListCubit, ListState>(
      builder: (context, state) {
        final fresh = context.read<ListCubit>().fresh;
        if (fresh.isEmpty) {
          return Text(household);
        }
        final by = {for (final id in fresh) state.items[id]?.addedBy};
        final partner = by.length == 1 ? state.catalog.member(by.single) : null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(household),
            Text(
              partner == null
                  ? l10n.newItems(fresh.length)
                  : l10n.newItemsFrom(fresh.length, partner.displayName),
              key: const ValueKey('new-items-subtitle'),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        );
      },
    );
  }
}

/// Usuals for what is typed, or the due ones while the field is empty.
class const _UsualChips({
  required final String text,
  required final ValueChanged<Usual> onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return BlocBuilder<ListCubit, ListState>(
      builder: (context, _) {
        final cubit = context.read<ListCubit>();
        final typing = text.trim().isNotEmpty;
        final usuals = typing ? cubit.suggestionsFor(text) : cubit.dueUsuals;
        if (usuals.isEmpty) {
          return const SizedBox.shrink();
        }
        return Padding(
          key: ValueKey(typing ? 'suggestions' : 'due-suggestions'),
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                spacing: 8,
                children: [
                  if (!typing) Text(l10n.dueSuggestions),
                  for (final usual in usuals) _chip(l10n, usual),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _chip(AppLocalizations l10n, Usual usual) {
    final label = [?usual.quantity, usual.name].join(' ');
    return Semantics(
      label: l10n.suggestion(label),
      button: true,
      excludeSemantics: true,
      onTap: () => onTap(usual),
      child: ActionChip(
        key: ValueKey('suggestion-${usual.name}'),
        label: Text(label),
        onPressed: () => onTap(usual),
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

enum _MenuAction() {
  categories,
  invite,
  join,
  access,
  account,
  signOut,
}

class const _Menu({required final Household household})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopupMenuButton<_MenuAction>(
      tooltip: l10n.menu,
      onSelected: (action) => unawaited(switch (action) {
        _MenuAction.categories => openCategories(context),
        _MenuAction.invite => showInviteDialog(context, household),
        _MenuAction.join => showJoinCodeDialog(context),
        _MenuAction.access => context.push(settingsPath),
        _MenuAction.account => context.push('$settingsPath?section=account'),
        _MenuAction.signOut => context.read<SessionCubit>().signOut(),
      }),
      itemBuilder: (_) => [
        PopupMenuItem(
          value: _MenuAction.categories,
          child: Text(l10n.manageCategories),
        ),
        PopupMenuItem(
          value: _MenuAction.invite,
          child: Text(l10n.inviteMember),
        ),
        PopupMenuItem(
          value: _MenuAction.join,
          child: Text(l10n.joinOtherHousehold),
        ),
        PopupMenuItem(value: _MenuAction.access, child: Text(l10n.accessTitle)),
        PopupMenuItem(
          key: const ValueKey('menu-account'),
          value: _MenuAction.account,
          child: Text(l10n.account),
        ),
        PopupMenuItem(value: _MenuAction.signOut, child: Text(l10n.signOut)),
      ],
    );
  }
}
