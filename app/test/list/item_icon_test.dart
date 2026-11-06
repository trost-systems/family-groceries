import 'package:family_groceries/list/list_view/item_icon.dart';
import 'package:family_groceries/list/list_view/item_icon_fallback.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final icons = ItemIcons(const {
    'milch': '🥛',
    'kaffee': '☕',
    'reis': '🍚',
    'eis': '🍨',
    '=ei': '🥚',
    'tee': '🍵',
    'salat': '🥬',
    'kartoffelsalat': '',
    'aepfel': '🍎',
    'weisswurst': '🌭',
    'rote bete': '🟣',
    'bete': '🥕',
    'hot dog': '🌭',
    'dog food': '',
    'eis am stiel': '🍦',
    '=brot': '🍞',
  });

  group('emojiFor', () {
    test('the first word with an icon decides', () {
      expect(icons.emojiFor('Milch für Kaffee'), '🥛');
      expect(icons.emojiFor('Kaffee, Milch'), '☕');
      expect(icons.emojiFor('Bio Milch'), '🥛');
    });

    test('a compound takes its longest head of three letters or more', () {
      expect(icons.emojiFor('Vollmilch'), '🥛');
      expect(icons.emojiFor('Basmatireis'), '🍚', reason: 'reis, not eis');
      expect(icons.emojiFor('Vanilleeis'), '🍨');
      expect(icons.emojiFor('Pfefferminztee'), '🍵');
      expect(icons.emojiFor('Reis'), '🍚');
      expect(
        icons.emojiFor('Preis'),
        isNull,
        reason: 'the rest, "p", is short',
      );
      expect(icons.emojiFor('Mtee'), isNull);
    });

    test('a = form matches the whole word only', () {
      expect(icons.emojiFor('Ei'), '🥚');
      expect(icons.emojiFor('6 Eier, Ei'), '🥚');
      expect(icons.emojiFor('Brei'), isNull);
      expect(icons.emojiFor('Frühstücksei'), isNull);
    });

    test('a stop shows the fallback, and the next word still counts', () {
      expect(icons.emojiFor('Kartoffelsalat'), isNull);
      expect(icons.emojiFor('Bio-Kartoffelsalat'), isNull);
      expect(icons.emojiFor('Kartoffelsalat mit Milch'), '🥛');
      expect(icons.emojiFor('Gurkensalat'), '🥬');
    });

    test('phrases come before their words, three words before two', () {
      expect(icons.emojiFor('Rote Bete'), '🟣');
      expect(icons.emojiFor('Bete'), '🥕');
      expect(icons.emojiFor('Eis am Stiel'), '🍦');
      expect(icons.emojiFor('Eis am'), '🍨');
      expect(icons.emojiFor('dog food, hot dog'), '🌭');
    });

    test('names fold like foldName: case, umlauts, ß, spaces', () {
      expect(icons.emojiFor('  ÄPFEL '), '🍎');
      expect(icons.emojiFor('Weißwurst'), '🌭');
      expect(icons.emojiFor('rote   BETE'), '🟣');
    });

    test('no word with an icon means none', () {
      expect(icons.emojiFor('Geschenkkarte'), isNull);
      expect(icons.emojiFor(''), isNull);
      expect(icons.emojiFor('42 — !'), isNull);
    });

    test('costs about one lookup per letter, however big the table', () {
      final big = ItemIcons({
        for (var i = 0; i < 20000; i++) 'x${i.toRadixString(26)}y': '🥛',
      });
      final name = List.filled(2000, 'q' * 60).join(' ');
      final watch = Stopwatch()..start();
      expect(big.emojiFor(name), isNull);
      expect(
        watch.elapsedMilliseconds,
        lessThan(1000),
        reason: '2,000 words of 60 letters',
      );
    });
  });

  group('over', () {
    test('remote entries replace a form with or without its =', () {
      final remote = icons.over(const {
        'brot': '🥖',
        '=tee': '🫖',
        '=reis': '🍙',
        'kartoffelsalat': '🥔',
        'quark': '🥣',
        'milch': '',
      });
      expect(remote.emojiFor('Vollkornbrot'), '🥖');
      expect(remote.emojiFor('Tee'), '🫖');
      expect(remote.emojiFor('Pfefferminztee'), isNull);
      expect(remote.emojiFor('Reis'), '🍙');
      expect(
        remote.emojiFor('Basmatireis'),
        '🍨',
        reason: 'reis is whole-word now',
      );
      expect(remote.emojiFor('Kartoffelsalat'), '🥔');
      expect(remote.emojiFor('Magerquark'), '🥣');
      expect(remote.emojiFor('Vollmilch'), isNull);
      expect(icons.emojiFor('Vollkornbrot'), isNull, reason: 'base unchanged');
    });
  });

  group('ItemIcon', () {
    Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
      MaterialApp(
        home: Center(child: SizedBox(width: 28, child: child)),
      ),
    );

    testWidgets('shows the emoji, or the fallback in the same box', (
      tester,
    ) async {
      final cubit = ItemIconsCubit(icons);
      addTearDown(cubit.close);
      await pump(
        tester,
        BlocProvider.value(
          value: cubit,
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ItemIcon('Vollmilch', size: 18, height: 21.25),
              ItemIcon('Geschenkkarte', size: 18, height: 21.25),
            ],
          ),
        ),
      );
      expect(find.text('🥛'), findsOneWidget);
      expect(find.byType(ItemIconFallback), findsOneWidget);
      final [emoji, fallback] = tester
          .widgetList(find.byType(ItemIcon))
          .map((w) => tester.getSize(find.byWidget(w)))
          .toList();
      expect(fallback, emoji);

      cubit.use(icons.over(const {'karte': '🎁'}));
      await tester.pump();
      expect(find.text('🎁'), findsOneWidget);
      expect(find.byType(ItemIconFallback), findsNothing);
    });

    testWidgets('without a cubit it reads the bundled table', (tester) async {
      const name = 'Geschenkkarte';
      await pump(tester, const ItemIcon(name, size: 18));
      final emoji = ItemIcons.bundled.emojiFor(name);
      expect(
        emoji == null ? find.byType(ItemIconFallback) : find.text(emoji),
        findsOneWidget,
      );
    });
  });
}
