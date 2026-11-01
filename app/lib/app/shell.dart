import 'package:family_groceries/design/motion.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/list_scope.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// From this width the tabs become a rail and More shows two panes.
const wideLayout = 840.0;

/// The widest a settings page's list runs (store layout, categories, Läden):
/// on a wide window it stays a readable column (job 56 item 26).
const pageMaxWidth = 640.0;

/// Whether the add sheet is open. The shell hides the tabs while it is;
/// the List tab opens and closes it. Leaving the tab closes it.
class const SheetOpen({
  required super.notifier,
  required super.child,
  super.key,
}) extends InheritedNotifier<SheetOpenNotifier> {
  static SheetOpenNotifier of(BuildContext context) => maybeOf(context)!;

  /// Null outside the shell (widget tests of a single tab).
  static SheetOpenNotifier? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SheetOpen>()?.notifier;
}

/// [SheetOpen]'s value, which a closing list can still reset after the
/// shell is gone.
class SheetOpenNotifier() extends ValueNotifier<bool> {
  this : super(false);

  var _disposed = false;

  /// Shows the tabs again, unless the shell went away meanwhile.
  void release() {
    if (!_disposed) {
      value = false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

/// The signed-in app: the List and More tabs, as a bottom bar on phones
/// and a rail from [wideLayout] on.
class const AppShell({
  required final StatefulNavigationShell shell,
  super.key,

  /// Overrides the Supabase list repository, for tests.
  final ListRepository? repository,
}) extends StatefulWidget {
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState() extends State<AppShell> {
  final _sheetOpen = SheetOpenNotifier();

  @override
  void dispose() {
    _sheetOpen.dispose();
    super.dispose();
  }

  void _select(int index) {
    _sheetOpen.value = false;
    // Tapping the current tab again goes back to its first page.
    widget.shell.goBranch(
      index,
      initialLocation: index == widget.shell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final index = widget.shell.currentIndex;
    return ListScope(
      repository: widget.repository,
      child: SheetOpen(
        notifier: _sheetOpen,
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth >= wideLayout) {
              return Scaffold(
                body: Row(
                  children: [
                    NavigationRail(
                      selectedIndex: index,
                      onDestinationSelected: _select,
                      labelType: NavigationRailLabelType.all,
                      backgroundColor: Theme.of(context)
                          .colorScheme
                          .surfaceContainerLow,
                      destinations: [
                        NavigationRailDestination(
                          icon: const Icon(
                            Icons.shopping_cart_outlined,
                            key: ValueKey('tab-list'),
                          ),
                          selectedIcon: const Icon(Icons.shopping_cart),
                          label: Text(l10n.tabList),
                        ),
                        NavigationRailDestination(
                          icon: const Icon(
                            Icons.menu,
                            key: ValueKey('tab-more'),
                          ),
                          label: Text(l10n.tabMore),
                        ),
                      ],
                    ),
                    const VerticalDivider(width: 1),
                    Expanded(child: widget.shell),
                  ],
                ),
              );
            }
            return Scaffold(
              body: widget.shell,
              bottomNavigationBar: _Tabs(index: index, onSelect: _select),
            );
          },
        ),
      ),
    );
  }
}

/// "Liste" and "Mehr". While the add sheet is open they slide away and the
/// band shows how adding works; the band keeps its height, so the input
/// above it stays put.
class const _Tabs({
  required final int index,
  required final ValueChanged<int> onSelect,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final open = SheetOpen.of(context).value;
    final duration = hlMotion(context, HlDuration.medium);
    final curve = open ? HlEasing.exit : HlEasing.standard;
    return ColoredBox(
      color: scheme.surfaceContainerLow,
      child: Stack(
        children: [
          Positioned.fill(
            child: SafeArea(
              top: false,
              child: AnimatedOpacity(
                opacity: open ? 1 : 0,
                duration: hlMotion(context, HlDuration.short),
                curve: Interval(open ? 0.4 : 0, 1),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                  child: Text(
                    l10n.addSheetHint,
                    key: const ValueKey('add-sheet-hint'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
          ),
          IgnorePointer(
            ignoring: open,
            child: ExcludeFocus(
              excluding: open,
              child: ExcludeSemantics(
                excluding: open,
                child: AnimatedSlide(
                  offset: Offset(0, open ? 1 : 0),
                  duration: duration,
                  curve: curve,
                  child: AnimatedOpacity(
                    opacity: open ? 0 : 1,
                    duration: hlMotion(context, HlDuration.short),
                    child: NavigationBar(
                      height: 62,
                      selectedIndex: index,
                      onDestinationSelected: onSelect,
                      backgroundColor: Colors.transparent,
                      elevation: 0,
                      labelTextStyle: const WidgetStatePropertyAll(
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      destinations: [
                        NavigationDestination(
                          key: const ValueKey('tab-list'),
                          icon: const Icon(Icons.shopping_cart_outlined),
                          selectedIcon: const Icon(Icons.shopping_cart),
                          label: l10n.tabList,
                        ),
                        NavigationDestination(
                          key: const ValueKey('tab-more'),
                          icon: const Icon(Icons.menu),
                          label: l10n.tabMore,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
