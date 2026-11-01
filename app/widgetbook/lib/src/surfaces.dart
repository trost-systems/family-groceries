import 'package:family_groceries/design/tokens.g.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Material/Flächen';

/// Navigation, feedback and containers as the app's theme draws them.
final surfaceComponents = [
  component(_path, 'NavigationBar', [
    plain('Liste und Mehr', (context) => const _Navigation()),
  ]),
  component(_path, 'SnackBar', [
    plain('Mit Rückgängig', (context) => const _SnackBarDemo()),
  ]),
  component(_path, 'AlertDialog', [
    plain(
      'Bestätigen',
      (context) => AlertDialog(
        title: const Text('Erledigte löschen?'),
        content: const Text(
          'Die 4 abgehakten Einträge verschwinden aus dem Verlauf.',
        ),
        actions: [
          TextButton(onPressed: () {}, child: const Text('Abbrechen')),
          FilledButton(onPressed: () {}, child: const Text('Löschen')),
        ],
      ),
    ),
  ]),
  component(_path, 'BottomSheet', [
    plain('Eintrag bearbeiten', (context) => const _Sheet()),
  ]),
  component(_path, 'Card', [
    plain(
      'Mit ListTile',
      (context) => SizedBox(
        width: 360,
        child: Card(
          child: ListTile(
            leading: const Icon(Icons.group_outlined),
            title: const Text('Zuhause'),
            subtitle: Text(
              'Peter und Lea',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: const Icon(Icons.chevron_right),
          ),
        ),
      ),
    ),
  ]),
];

class const _Navigation() extends StatefulWidget {
  @override
  State<_Navigation> createState() => _NavigationState();
}

class _NavigationState() extends State<_Navigation> {
  var _index = 0;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 390,
    child: NavigationBar(
      selectedIndex: _index,
      onDestinationSelected: (index) => setState(() => _index = index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.shopping_cart_outlined),
          selectedIcon: Icon(Icons.shopping_cart),
          label: 'Liste',
        ),
        NavigationDestination(icon: Icon(Icons.menu), label: 'Mehr'),
      ],
    ),
  );
}

/// A snackbar with an action shows until it is acted on or replaced.
class const _SnackBarDemo() extends StatefulWidget {
  @override
  State<_SnackBarDemo> createState() => _SnackBarDemoState();
}

class _SnackBarDemoState() extends State<_SnackBarDemo> {
  final _messenger = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _show());
  }

  void _show() => _messenger.currentState
    ?..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        content: const Text('Bananen abgehakt'),
        action: SnackBarAction(label: 'Rückgängig', onPressed: () {}),
      ),
    );

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 420,
    height: 240,
    child: ScaffoldMessenger(
      key: _messenger,
      child: Scaffold(
        body: Center(
          child: OutlinedButton(
            onPressed: _show,
            child: const Text('Nochmal zeigen'),
          ),
        ),
      ),
    ),
  );
}

/// The sheet's own surface, without the route that slides it in.
class const _Sheet() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      width: 390,
      child: BottomSheet(
        onClosing: () {},
        enableDrag: false,
        builder: (context) => Padding(
          padding: const EdgeInsets.all(HlSpace.s5),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: HlSpace.s4,
            children: [
              Text('Bananen', style: text.titleLarge),
              const TextField(decoration: InputDecoration(labelText: 'Menge')),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                spacing: HlSpace.s3,
                children: [
                  TextButton(onPressed: () {}, child: const Text('Abbrechen')),
                  FilledButton(
                    onPressed: () {},
                    child: const Text('Speichern'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
