// Goldens of the themed components in every state, light and dark (design
// job 52). After a deliberate look change:
//   flutter test --update-goldens test/design/components_golden_test.dart
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/list/store_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fonts.dart';

typedef _State = ({String name, Set<WidgetState> states, bool enabled});

const List<_State> _states = [
  (name: 'Ruhe', states: {}, enabled: true),
  (name: 'Hover', states: {WidgetState.hovered}, enabled: true),
  (name: 'Fokus', states: {WidgetState.focused}, enabled: true),
  (name: 'Gedrückt', states: {WidgetState.pressed}, enabled: true),
  (name: 'Aus', states: {WidgetState.disabled}, enabled: false),
];

Widget _grid(Brightness brightness) {
  Widget cell(Widget child) =>
      SizedBox(width: 150, height: 72, child: Center(child: child));
  Widget row(String label, Widget Function(_State s) build) => Row(
    children: [
      SizedBox(width: 90, child: Text(label)),
      for (final s in _states) cell(build(s)),
    ],
  );
  VoidCallback? on(_State s) => s.enabled ? () {} : null;
  WidgetStatesController controller(_State s) =>
      WidgetStatesController(s.states);
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: appTheme(brightness),
    home: Builder(
      builder: (context) {
        final scheme = Theme.of(context).colorScheme;
        return Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(HlSpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SizedBox(width: 90),
                    for (final s in _states)
                      SizedBox(
                        width: 150,
                        child: Center(
                          child: Text(
                            s.name,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                      ),
                  ],
                ),
                row(
                  'Filled',
                  (s) => FilledButton(
                    statesController: controller(s),
                    onPressed: on(s),
                    child: const Text('Anlegen'),
                  ),
                ),
                row(
                  'Filled.icon',
                  (s) => FilledButton.icon(
                    statesController: controller(s),
                    onPressed: on(s),
                    icon: const Icon(Icons.add),
                    label: const Text('Neu'),
                  ),
                ),
                row(
                  'Outlined',
                  (s) => OutlinedButton(
                    statesController: controller(s),
                    onPressed: on(s),
                    child: const Text('Später'),
                  ),
                ),
                row(
                  'Text',
                  (s) => TextButton(
                    statesController: controller(s),
                    onPressed: on(s),
                    child: const Text('Abbrechen'),
                  ),
                ),
                row(
                  'Chip',
                  (s) => ChoiceChip(
                    label: const Text('Fehler'),
                    selected: s.states.contains(WidgetState.pressed),
                    onSelected: s.enabled ? (_) {} : null,
                  ),
                ),
                row(
                  'Checkbox',
                  (s) => Checkbox(
                    value: s.states.contains(WidgetState.pressed),
                    onChanged: s.enabled ? (_) {} : null,
                  ),
                ),
                Row(
                  spacing: HlSpace.s4,
                  children: [
                    const SizedBox(width: 90, child: Text('Laden')),
                    FilledButton(
                      onPressed: () {},
                      child: const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                    ),
                    FloatingActionButton.extended(
                      onPressed: () {},
                      icon: const Icon(Icons.add),
                      label: const Text('Kategorie'),
                    ),
                    for (final store in const [
                      Store(id: 'dm', name: 'dm', sortOrder: 0, seedKey: 'dm'),
                      Store(
                        id: 'lidl',
                        name: 'Lidl',
                        sortOrder: 0,
                        seedKey: 'lidl',
                      ),
                      Store(id: 'own', name: 'Bäcker', sortOrder: 0),
                    ])
                      StoreBadge(store),
                  ],
                ),
                const SizedBox(height: HlSpace.s4),
                NavigationBar(
                  destinations: const [
                    NavigationDestination(
                      icon: Icon(Icons.shopping_cart),
                      label: 'Liste',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.menu),
                      label: 'Mehr',
                    ),
                  ],
                ),
                const SizedBox(height: HlSpace.s4),
                Card(
                  child: ListTile(
                    title: const Text('Karte'),
                    subtitle: Text(
                      'Oberfläche, Kontur, Radius m',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  ),
                ),
                Builder(
                  builder: (context) => Text(
                    'Hummlist',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    testWidgets('component states, ${brightness.name}', (tester) async {
      tester.view
        ..devicePixelRatio = 1
        ..physicalSize = const Size(880, 820);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_grid(brightness));
      // The spinner never settles.
      await tester.pump(const Duration(milliseconds: 500));
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/components-${brightness.name}.png'),
      );
    });
  }
}
