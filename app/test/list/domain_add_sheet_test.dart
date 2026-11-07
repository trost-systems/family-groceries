import 'dart:async';

import 'package:family_groceries/list/add_sheet/add_sheet_cubit.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/entry.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

/// The add sheet's state machine driven through its public API, against the
/// in-memory server: what Enter adds, when the server is asked, and which rows
/// show without it.
void main() {
  late FakeRepository repo;
  late ListCubit list;
  late AddSheetCubit sheet;

  Future<void> settle() => pumpEventQueue();

  Future<void> start({void Function(FakeRepository repo)? seed}) async {
    repo = FakeRepository();
    seed?.call(repo);
    list = ListCubit(repo, MemoryListCache(), userId: 'peter')..start();
    await settle();
    sheet = AddSheetCubit(list, debounce: Duration.zero)..show();
    addTearDown(() async {
      await sheet.close();
      await list.close();
    });
  }

  String? addedName(AddResult? result) => switch (result) {
    Added(:final item) => item.name,
    _ => null,
  };

  const hafermilch = Suggestion(
    SuggestionSource.history,
    ParsedEntry(name: 'Hafermilch'),
  );

  group('Enter', () {
    test(
      'takes the rows already answered without asking the server again',
      () async {
        await start(seed: (r) => r.suggestions['milch'] = const [hafermilch]);
        sheet.type('milch');
        await settle();
        expect(repo.suggestCalls, ['milch']);

        final result = await sheet.takeFirst();

        expect(addedName(result), 'Hafermilch');
        expect(repo.suggestCalls, ['milch'], reason: 'the answer was there');
      },
    );

    test('waits for the rows of the new text, not the ones still shown for '
        'the old text', () async {
      await start(seed: (r) => r.suggestions['milch'] = const [hafermilch]);
      sheet.type('milch');
      await settle();
      sheet.type('Brot');
      expect(sheet.state.suggestions.map((s) => s.entry.name), [
        'Hafermilch',
      ], reason: 'the old rows stay until the new ones arrive');

      final result = await sheet.takeFirst();

      expect(addedName(result), 'Brot');
      expect(list.state.items.values.map((i) => i.name), ['Brot']);
    });

    test('after the server answered no rows asks again and adds what it '
        'answers then', () async {
      await start(seed: (r) => r.suggestions['wurst'] = const []);
      sheet.type('wurst');
      await settle();
      expect(sheet.state.suggestions, isEmpty);
      repo.suggestions['wurst'] = const [
        Suggestion(SuggestionSource.typed, ParsedEntry(name: 'Wurst')),
      ];

      final result = await sheet.takeFirst();

      expect(addedName(result), 'Wurst');
      expect(repo.suggestCalls, ['wurst', 'wurst']);
    });

    test(
      'adds nothing when the sheet is dismissed while the rows load',
      () async {
        await start();
        repo.suggestGate = Completer<void>();
        sheet.type('Milch');
        final pending = sheet.takeFirst();
        sheet.dismiss();
        repo.suggestGate!.complete();

        expect(await pending, isNull);
        await settle();
        expect(list.state.items, isEmpty);
      },
    );

    test('adds nothing when the text changes while its rows load', () async {
      await start(seed: (r) => r.suggestions['milch'] = const [hafermilch]);
      repo.suggestGate = Completer<void>();
      sheet.type('milch');
      final pending = sheet.takeFirst();
      sheet.type('Brot');
      repo.suggestGate!.complete();

      expect(await pending, isNull);
      await settle();
      expect(list.state.items, isEmpty);
    });
  });

  test('after a failed fetch, the same text asks the server again', () async {
    await start(seed: (r) => r.suggestions['milch'] = const [hafermilch]);
    repo.online = false;
    sheet.type('milch');
    await settle();
    expect(sheet.state.suggestions.map((s) => s.entry.name), [
      'milch',
    ], reason: 'offline: the typed line alone');

    repo.online = true;
    sheet
      ..type('mil')
      ..type('milch');
    await settle();

    expect(repo.suggestCalls, ['milch', 'milch']);
    expect(sheet.state.suggestions.map((s) => s.entry.name), ['Hafermilch']);
  });

  test(
    'without the server, a usual spelled like the typed line is one row',
    () async {
      await start(
        seed: (r) => r.usuals = const [
          Usual(name: 'Milch', due: false),
          Usual(name: 'Milchreis', due: false),
        ],
      );
      expect(list.state.usuals, hasLength(2), reason: 'the usuals loaded');
      repo.suggestGate = Completer<void>();

      sheet.type('Milch');

      expect(sheet.state.suggestions.map((s) => (s.source, s.entry.name)), [
        (SuggestionSource.typed, 'Milch'),
        (SuggestionSource.history, 'Milchreis'),
      ]);
      repo.suggestGate!.complete();
    },
  );

  group('parseEntry', () {
    test('reads a capitalised "Halbes" up front as a half', () {
      expect(parseEntry('Halbes Brot'), const Entry('Brot', '1/2'));
    });

    test('a number name only counts as a whole word: "Drei Glockenblumen" '
        'is three', () {
      expect(
        parseEntry('Drei Glockenblumen'),
        const Entry('Glockenblumen', '3'),
      );
      expect(
        parseEntry('Drei Glocken Spaghetti'),
        const Entry('Drei Glocken Spaghetti', null),
      );
    });
  });
}
