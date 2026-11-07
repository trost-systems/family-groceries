import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/add_sheet/add_sheet_cubit.dart';
import 'package:family_groceries/list/add_sheet/suggestion.dart';
import 'package:family_groceries/list/category_names.dart';
import 'package:family_groceries/list/entry.dart';
import 'package:family_groceries/list/list_cache.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_repository.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_repository.dart';
import 'memory_cache.dart';

void main() {
  group('category names', () {
    final en = lookupAppLocalizations(const Locale('en'));
    final de = lookupAppLocalizations(const Locale('de'));

    // Seed key, German seed name, English name (app_de.arb, app_en.arb).
    const seeded = [
      ('produce', 'Obst & Gemüse', 'Fruit & veg'),
      ('bakery', 'Brot & Backwaren', 'Bread & bakery'),
      ('chilled', 'Kühlregal', 'Chilled'),
      ('meat', 'Fleisch/Wurst/Fisch', 'Meat & fish'),
      ('pantry', 'Vorrat & Konserven', 'Pantry'),
      ('sweets', 'Süßes & Snacks', 'Sweets & snacks'),
      ('drinks', 'Getränke', 'Drinks'),
      ('frozen', 'Tiefkühl', 'Frozen'),
      ('household', 'Haushalt', 'Household'),
      ('drugstore', '👶 Drogerie', '👶 Drugstore'),
      ('other', 'Sonstiges', 'Other'),
    ];

    Category category(String? seedKey, String name) =>
        Category(id: 'c', name: name, sortOrder: 10, seedKey: seedKey);

    test('a seeded category not renamed shows its name in the UI '
        'language', () {
      for (final (key, german, english) in seeded) {
        expect(categoryName(category(key, german), en), english, reason: key);
        expect(categoryName(category(key, german), de), german, reason: key);
      }
    });

    test('a renamed seeded category shows what the household wrote', () {
      expect(categoryName(category('produce', 'Gemüse'), en), 'Gemüse');
      expect(categoryName(category('meat', 'Fisch'), en), 'Fisch');
    });

    test('a seeded name under another seed key is a rename', () {
      expect(categoryName(category('bakery', 'Kühlregal'), en), 'Kühlregal');
    });

    test('a category the household made keeps its name', () {
      expect(categoryName(category(null, 'Tiefkühl'), en), 'Tiefkühl');
      expect(categoryName(category('unknown', 'Getränke'), en), 'Getränke');
    });
  });

  group('edit values', () {
    test('equal edits hash alike and collapse in a set', () {
      final read = ItemChanges.fromColumns(const {'quantity': '2 l'}).quantity!;
      expect(read.hashCode, const SetTo('2 l').hashCode);
      expect(const SetTo('2 l').hashCode, isNot(const SetTo('3 l').hashCode));
      expect({read, const SetTo('2 l'), const SetTo('3 l')}, hasLength(2));
    });

    test('an edit reads as what it sets', () {
      expect(const SetTo('500 g').toString(), 'SetTo(500 g)');
      expect(const SetTo<String?>(null).toString(), 'SetTo(null)');
    });

    test('the same changes hash alike and collapse in a set', () {
      const a = ItemChanges(name: 'Möhren', quantity: SetTo('1 kg'));
      final b = ItemChanges.fromColumns(const {
        'quantity': '1 kg',
        'name': 'Möhren',
      });
      const other = ItemChanges(name: 'Karotten', quantity: SetTo('1 kg'));
      expect(a.hashCode, b.hashCode);
      expect(a.hashCode, isNot(other.hashCode));
      expect({a, b, other}, hasLength(2));
    });

    test('clearing a column is a change, so it hashes apart from leaving '
        'it', () {
      const clears = ItemChanges(name: 'Möhren', brand: SetTo(null));
      const leaves = ItemChanges(name: 'Möhren');
      expect(clears, isNot(leaves));
      expect(clears.hashCode, isNot(leaves.hashCode));
    });
  });

  group('a merge once its add turned out to be the open item kept', () {
    const merge = MergeItems(
      'copy',
      mergeId: 'm1',
      otherId: 'moehren',
      quantity: '1 kg',
      brand: 'Demeter',
      properties: 'Bio',
    );

    test('a merge of the copy merges into the kept item', () {
      final moved = merge.ontoKept('copy', 'kept')! as MergeItems;
      expect(moved.itemId, 'kept');
      expect(moved.otherId, 'moehren');
      expect(moved.mergeId, 'm1');
      expect(moved.quantity, '1 kg');
      expect(moved.brand, 'Demeter');
      expect(moved.properties, 'Bio');
    });

    test('a merge taking the copy in takes the kept item in', () {
      const into = MergeItems(
        'karotten',
        mergeId: 'm2',
        otherId: 'copy',
        quantity: '2',
        brand: null,
        properties: null,
      );
      final moved = into.ontoKept('copy', 'kept')! as MergeItems;
      expect(moved.itemId, 'karotten');
      expect(moved.otherId, 'kept');
      expect(moved.mergeId, 'm2');
      expect(moved.quantity, '2');
    });

    test('a merge with the item the copy turned out to be is nothing to '
        'do', () {
      expect(merge.ontoKept('copy', 'moehren'), isNull);
      expect(merge.ontoKept('moehren', 'copy'), isNull);
    });

    test('a merge of two other items stays as it is', () {
      expect(merge.ontoKept('brot', 'kept'), same(merge));
    });
  });

  group('list prefs', () {
    test('a copy changes only what it is given', () {
      const prefs = ListPrefs(folded: {'dm'});
      final dismissed = prefs.copyWith(hintDismissed: true);
      expect(dismissed.folded, {'dm'});
      expect(dismissed.hintDismissed, isTrue);
      final unfolded = dismissed.copyWith(folded: {});
      expect(unfolded.folded, isEmpty);
      expect(unfolded.hintDismissed, isTrue);
      expect(prefs.hintDismissed, isFalse);
    });

    test('prefs survive the cache', () {
      final back = ListPrefs.fromJson(
        const ListPrefs(
          folded: {'lidl', noStoreKey},
          hintDismissed: true,
        ).toJson(),
      );
      expect(back.folded, {'lidl', noStoreKey});
      expect(back.hintDismissed, isTrue);
    });
  });

  test('equal entries hash alike, so they key sets and maps', () {
    const a = Entry('Möhren', '1 kg');
    final b = parseEntry('1 kg Möhren');
    expect(b, a);
    expect(a.hashCode, b.hashCode);
    expect(a.hashCode, isNot(const Entry('Möhren', '2 kg').hashCode));
    expect(a.hashCode, isNot(const Entry('Karotten', '1 kg').hashCode));
    expect({a, b, const Entry('Möhren', null)}, hasLength(2));
    expect({a: 1}[b], 1);
  });

  test('a rejection reads as its message', () {
    expect(const RejectedOp('denied').toString(), 'RejectedOp(denied)');
  });

  test('a catalog change from realtime reloads the catalog shortly '
      'after', () {
    fakeAsync((async) {
      final repo = FakeRepository();
      final cubit = ListCubit(repo, MemoryListCache(), userId: 'peter')
        ..start();
      async.elapse(Duration.zero);
      expect(cubit.state.catalog.categories.first.name, 'Obst & Gemüse');

      repo
        ..categories = [
          const Category(id: 'produce', name: 'Gemüse', sortOrder: 10),
          ...repo.categories.skip(1),
        ]
        ..emitCatalogChanged!()
        ..emitCatalogChanged!();
      async.elapse(const Duration(milliseconds: 100));
      expect(
        cubit.state.catalog.categories.first.name,
        'Obst & Gemüse',
        reason: 'the reload waits a moment for more changes',
      );
      async.elapse(const Duration(milliseconds: 200));
      expect(cubit.state.catalog.categories.first.name, 'Gemüse');

      unawaited(cubit.close());
      async.flushMicrotasks();
    });
  });

  group('the add sheet drops a duplicate hint (job 32b)', () {
    late FakeRepository repo;
    late ListCubit list;
    late AddSheetCubit sheet;
    late DedupeHint hint;

    setUp(() async {
      repo = FakeRepository()
        ..canonical.addAll({'Möhren': 'mohr', 'Karotten': 'mohr'})
        ..remoteAdd('Möhren', categoryId: 'produce', quantity: '500 g');
      list = ListCubit(repo, MemoryListCache(), userId: 'peter')..start();
      sheet = AddSheetCubit(list);
      await pumpEventQueue();
      final hints = <DedupeHint>[];
      final listening = list.hints.listen(hints.add);
      sheet
        ..show()
        ..take(
          const Suggestion(
            SuggestionSource.typed,
            ParsedEntry(name: 'Karotten'),
          ),
        );
      await pumpEventQueue();
      await listening.cancel();
      hint = hints.single;
      expect(hint.onList.name, 'Möhren');
      expect(sheet.offer(hint), isTrue);
      expect(sheet.state.hint, same(hint));
    });

    tearDown(() async {
      await sheet.close();
      await list.close();
    });

    test('the hint shown leaves the note', () {
      sheet.drop(hint);
      expect(sheet.state.hint, isNull);
    });

    test('another hint leaves the note as it is', () {
      sheet.drop(DedupeHint(hint.added, hint.onList));
      expect(sheet.state.hint, same(hint));
    });

    test('a merge taken keeps its hint in the note for the undo', () {
      sheet.mergeHint();
      expect(sheet.state.merge, isNotNull);
      sheet.drop(hint);
      expect(sheet.state.hint, same(hint));
      expect(sheet.state.merge, isNotNull);
    });
  });
}
