import 'dart:async';
import 'dart:ui' show lerpDouble;

import 'package:family_groceries/design/motion.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/household/household_switcher.dart';
import 'package:family_groceries/household/member_tiles.dart';
import 'package:family_groceries/household/switcher_household.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_scope.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

/// The switcher sheet of the decluttered list (job 229, flag
/// `list-declutter`): today's household sheet as its first page, a page per
/// household with its lists, and one with its members. It opens on the
/// shown household's page. Needs the [ListScope] above [context].
Future<void> showSwitcherSheet(BuildContext context) {
  // Fresh counts while the sheet opens; offline it shows the last ones.
  unawaited(context.read<SessionCubit>().refresh().catchError((Object _) {}));
  final holds = context.read<ListHolds>();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (_) => RepositoryProvider<ListHolds>.value(
      value: holds,
      child: const SwitcherSheet(),
    ),
  );
}

/// Which page the switcher sheet shows.
sealed class const SwitcherPage() {
  /// Where back goes; null on the first page, where back closes the sheet.
  SwitcherPage? get back => switch (this) {
    HouseholdsPage() => null,
    HouseholdListsPage() => const HouseholdsPage(),
    MembersPage(:final householdId) => HouseholdListsPage(householdId),
  };
}

/// The user's households, as the household sheet shows them.
final class const HouseholdsPage() extends SwitcherPage;

/// A household's name, its members row and its lists.
final class const HouseholdListsPage(final String householdId)
    extends SwitcherPage;

/// A household's members and its open person invites.
final class const MembersPage(final String householdId) extends SwitcherPage;

class const SwitcherSheet({super.key}) extends StatefulWidget {
  @override
  State<SwitcherSheet> createState() => _SwitcherSheetState();
}

class _SwitcherSheetState() extends State<SwitcherSheet> {
  late final ListHolds _holds = context.read<ListHolds>();

  /// The household shown when the sheet opened, and its list, whose open
  /// items count better than the server's last answer.
  String? _shownId;
  ListCubit? _shownList;

  late SwitcherPage _page = switch (context.read<SessionCubit>().state) {
    InHousehold(:final household) => HouseholdListsPage(household.id),
    _ => const HouseholdsPage(),
  };

  @override
  void initState() {
    super.initState();
    if (context.read<SessionCubit>().state case InHousehold(:final household)) {
      _shownId = household.id;
      _shownList = _holds.hold(household.id);
    }
  }

  @override
  void dispose() {
    if (_shownId case final id?) {
      _holds.release(id);
    }
    super.dispose();
  }

  void _go(SwitcherPage page) => setState(() => _page = page);

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is! InHousehold) {
      return const SizedBox.shrink();
    }
    // A household left or removed meanwhile: the households show.
    final page = switch (_page) {
      HouseholdListsPage(:final householdId) || MembersPage(:final householdId)
          when !session.households.any((h) => h.id == householdId) =>
        const HouseholdsPage(),
      final page => page,
    };
    final duration = hlMotion(context, HlDuration.short);
    // The system back goes a page back; a tap beside the sheet, Escape or
    // a drag down closes it from any page.
    final view = BackButtonListener(
      onBackButtonPressed: () async {
        if (page.back case final back?) {
          _go(back);
          return true;
        }
        return false;
      },
      child: SafeArea(
        key: const ValueKey('switcher-sheet'),
        child: AnimatedSize(
          duration: duration,
          alignment: Alignment.topCenter,
          child: AnimatedSwitcher(
            duration: duration,
            layoutBuilder: _topAligned,
            child: switch (page) {
              HouseholdsPage() => _HouseholdsView(
                key: const ValueKey('switcher-households'),
                session: session,
                held: _shownId,
                open: (id) => _go(HouseholdListsPage(id)),
              ),
              HouseholdListsPage(:final householdId) ||
              MembersPage(:final householdId) => SwitcherHousehold(
                key: ValueKey('switcher-household-$householdId'),
                userId: session.userId,
                household: session.households.firstWhere(
                  (h) => h.id == householdId,
                ),
                shown: session.household.id == householdId,
                members: page is MembersPage,
                go: _go,
              ),
            },
          ),
        ),
      ),
    );
    return switch (_shownList) {
      final list? => BlocProvider.value(value: list, child: view),
      null => view,
    };
  }
}

/// AnimatedSwitcher's layout with the pages at the top: the sheet grows
/// and shrinks at its top edge, not around its middle.
Widget _topAligned(Widget? current, List<Widget> previous) =>
    Stack(alignment: Alignment.topCenter, children: [...previous, ?current]);

/// The first page: today's household sheet, where a row opens the
/// household's page instead of switching to it, and long-press then drag
/// orders the households.
class const _HouseholdsView({
  required final InHousehold session,

  /// The household whose list counts its open items better than the
  /// server's last answer: shown when the sheet opened.
  required final String? held,
  required final ValueChanged<String> open,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = SnacklistColors.of(Theme.of(context).brightness);
    final households = session.households;
    final shown = session.household.id;
    // The shown household's open items now, pending changes included.
    final openNow = context.select<ListCubit?, int?>(
      (list) => switch (list?.state) {
        final state? when state.loaded =>
          state.allItems.values
              .where((i) => i.status == ItemStatus.active)
              .length,
        _ => null,
      },
    );
    return CustomScrollView(
      shrinkWrap: true,
      slivers: [
        SliverToBoxAdapter(child: HouseholdSheetTitle(l10n.householdsTitle)),
        SliverReorderableList(
          itemCount: households.length,
          proxyDecorator: liftedRow,
          onReorderItem: (from, to) {
            final ids = [for (final h in households) h.id];
            ids.insert(to, ids.removeAt(from));
            unawaited(_reorder(context, ids));
          },
          itemBuilder: (context, i) {
            final household = households[i];
            final isShown = household.id == shown;
            return ReorderableRow(
              key: ValueKey(household.id),
              index: i,
              count: households.length,
              move: (to) {
                final ids = [for (final h in households) h.id];
                ids.insert(to, ids.removeAt(i));
                unawaited(_reorder(context, ids));
              },
              child: householdTile(
                context,
                household: household,
                shown: isShown,
                open: household.id == held
                    ? openNow ?? household.openCount
                    : household.openCount,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isShown)
                      Icon(
                        Icons.check,
                        key: const ValueKey('household-current'),
                        color: t.text,
                        semanticLabel: l10n.householdCurrent,
                      ),
                    Icon(Icons.chevron_right, color: t.textMuted),
                  ],
                ),
                onTap: () => open(household.id),
              ),
            );
          },
        ),
        SliverList.list(children: householdSheetTail(context, session)),
        const SliverPadding(padding: EdgeInsets.only(bottom: HlSpace.s3)),
      ],
    );
  }

  static Future<void> _reorder(BuildContext context, List<String> ids) {
    final session = context.read<SessionCubit>();
    return tellRefusal(context, () => session.reorderHouseholds(ids));
  }
}

/// A row that long-press then drag moves within its
/// [SliverReorderableList], and that screen readers move with "Nach oben"
/// and "Nach unten" ([move] gets the new index).
class const ReorderableRow({
  required final int index,
  required final int count,
  required final ValueChanged<int> move,
  required final Widget child,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Semantics(
      container: true,
      customSemanticsActions: {
        if (index > 0)
          CustomSemanticsAction(label: l10n.listMoveUp): () => move(index - 1),
        if (index < count - 1)
          CustomSemanticsAction(label: l10n.listMoveDown): () =>
              move(index + 1),
      },
      child: ReorderableDelayedDragStartListener(index: index, child: child),
    );
  }
}

/// A row while it is dragged: lifted off the sheet on the sheet's own
/// surface.
Widget liftedRow(Widget child, int index, Animation<double> animation) =>
    AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        final theme = Theme.of(context);
        final lift = Curves.easeOut.transform(animation.value);
        return Material(
          elevation: lerpDouble(0, 6, lift) ?? 0,
          color:
              theme.bottomSheetTheme.backgroundColor ??
              theme.colorScheme.surface,
          borderRadius: const BorderRadius.all(Radius.circular(HlRadius.s)),
          child: child,
        );
      },
      child: child,
    );

/// "‹ Haushalte" and "‹ Zuhause": back to [label]'s page.
class const SwitcherBackRow(
  final String label, {
  required final VoidCallback onBack,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsetsDirectional.only(start: HlSpace.s2),
    child: Align(
      alignment: AlignmentDirectional.centerStart,
      child: TextButton.icon(
        key: const ValueKey('switcher-back'),
        style: TextButton.styleFrom(
          visualDensity: VisualDensity.standard,
          minimumSize: const Size(HlSize.target, HlSize.target),
        ),
        icon: const Icon(Icons.arrow_back),
        label: Semantics(
          label: AppLocalizations.of(context).switcherBack(label),
          excludeSemantics: true,
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        onPressed: onBack,
      ),
    ),
  );
}
