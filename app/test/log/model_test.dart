import 'package:family_groceries/list/model.dart' show Store;
import 'package:family_groceries/log/model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  final today = DateTime(2026, 11, 12);

  group('journalSections', () {
    test('this week from Monday, last week, then each month, newest '
        'first', () {
      final thu = trip(2026, 11, 12, store: 'lidl');
      final mon = trip(2026, 11, 9, store: 'rewe');
      final sun = trip(2026, 11, 8, store: 'dm');
      final lastMon = trip(2026, 11, 2, store: 'lidl');
      final nov1 = trip(2026, 11, 1, store: 'lidl');
      final oct = trip(2026, 10, 31, store: 'rewe');
      final dec = trip(2025, 12, 24);
      final sections = journalSections([
        oct,
        dec,
        sun,
        thu,
        nov1,
        lastMon,
        mon,
      ], today);
      expect(sections.map((s) => s.period), [
        const ThisWeek(),
        const LastWeek(),
        const InMonth(2026, 11),
        const InMonth(2026, 10),
        const InMonth(2025, 12),
      ]);
      expect(sections.map((s) => s.trips), [
        [thu, mon],
        [sun, lastMon],
        [nov1],
        [oct],
        [dec],
      ]);
    });

    test('two trips on one day: the later save first', () {
      final first = trip(2026, 11, 10, store: 'lidl');
      final second = trip(2026, 11, 10, store: 'rewe');
      expect(journalSections([first, second], today).single.trips, [
        second,
        first,
      ]);
    });

    test('no trips, no sections', () {
      expect(journalSections(const [], today), isEmpty);
    });
  });

  group('storeBlocks', () {
    test('every store in household order, empty ones too, then gone stores '
        'by their saved name, then Ohne Laden', () {
      final lidlOld = trip(2026, 11, 2, store: 'lidl');
      final lidlNew = trip(2026, 11, 10, store: 'lidl');
      final edeka = trip(2026, 11, 5, storeName: 'Edeka');
      final edekaStale = trip(2026, 11, 6, store: 'gone', storeName: 'Edeka');
      final none = trip(2026, 11, 7);
      final blocks = storeBlocks(
        [lidlOld, edeka, none, lidlNew, edekaStale],
        [lidl, rewe, dm],
      );
      expect(
        [
          for (final b in blocks)
            (b.storeId, b.name, [for (final t in b.trips) t.id].join(' ')),
        ],
        [
          ('lidl', 'Lidl', '${lidlNew.id} ${lidlOld.id}'),
          ('rewe', 'Rewe', ''),
          ('dm', 'dm', ''),
          (null, 'Edeka', '${edekaStale.id} ${edeka.id}'),
          (null, null, none.id),
        ],
      );
    });

    test('no Ohne Laden block without such a trip', () {
      final blocks = storeBlocks([trip(2026, 11, 2, store: 'dm')], stores);
      expect(blocks.map((b) => b.name), ['Lidl', 'Rewe', 'dm']);
    });
  });

  group('dayMarks', () {
    String colour(Trip t) => t.storeId ?? 'none';
    final month = DateTime(2026, 11);

    test('one dot per trip, newest first, at most three; the count is '
        'real', () {
      final marks = dayMarks(
        [
          trip(2026, 11, 12, store: 'lidl'),
          trip(2026, 11, 12, store: 'rewe'),
          trip(2026, 11, 12, store: 'lidl'),
          trip(2026, 11, 10, store: 'dm'),
          trip(2026, 11, 10),
          for (var i = 0; i < 5; i++) trip(2026, 11, 3, store: 'rewe'),
        ],
        month,
        colour,
      );
      (String, int)? at(int day) => switch (marks[day]) {
        (:final colours, :final count) => (colours.join(' '), count),
        null => null,
      };
      expect(at(12), ('lidl rewe lidl', 3));
      expect(at(10), ('none dm', 2));
      expect(at(3), ('rewe rewe rewe', 5));
      expect(marks.containsKey(11), isFalse, reason: 'no trip, no mark');
    });

    test("another month's trips are not this month's days", () {
      final marks = dayMarks(
        [trip(2026, 10, 12, store: 'lidl'), trip(2025, 11, 12, store: 'dm')],
        month,
        colour,
      );
      expect(marks, isEmpty);
    });
  });

  test('storeColourIndex: household order round the palette; none and gone '
      'are neutral', () {
    expect(storeColourIndex('lidl', stores), 0);
    expect(storeColourIndex('dm', stores), 2);
    expect(storeColourIndex(null, stores), isNull);
    expect(storeColourIndex('gone', stores), isNull);
    final many = [
      for (var i = 0; i < 8; i++) Store(id: 's$i', name: 'S$i', sortOrder: i),
    ];
    expect(storeColourIndex('s6', many), 0);
    expect(storeColourIndex('s7', many), 1);
  });

  group('LogView', () {
    test('the toggle cycles journal, stores, journal', () {
      expect(LogView.journal.next, LogView.stores);
      expect(LogView.stores.next, LogView.journal);
    });

    test('parses its stored name, nothing else', () {
      expect(LogView.parse('stores'), LogView.stores);
      expect(LogView.parse('calendar'), isNull);
      expect(LogView.parse(null), isNull);
    });
  });

  test('a server row: the day as a local date, amounts optional', () {
    final row = Trip.fromJson(const {
      'id': 'a',
      'store_id': null,
      'store_name': 'Edeka',
      'shopped_on': '2026-03-29',
      'items': [
        {'name': 'Milch', 'quantity': '2 l', 'canonical_key': 'milch'},
        {'name': 'Brot', 'quantity': null, 'canonical_key': 'brot'},
      ],
      'logged_by': 'peter',
      'created_at': '2026-03-29T08:00:00.000Z',
    });
    expect(row.day, DateTime(2026, 3, 29));
    expect(row.items, const [
      TripItem(name: 'Milch', quantity: '2 l'),
      TripItem(name: 'Brot'),
    ]);
    expect(row.storeName, 'Edeka');
    expect(wireDay(row.day), '2026-03-29');
    expect(row.items.first.toJson(), {'name': 'Milch', 'quantity': '2 l'});
  });

  group('TripHistory.fromJson', () {
    final row = {
      'id': 't1',
      'household_id': 'h1',
      'store_id': null,
      'store_name': 'Kaufland',
      'shopped_on': '2026-11-10',
      'items': [
        {'name': 'Milch', 'quantity': '2 l', 'canonical_key': 'milch'},
      ],
      'logged_by': 'peter',
      'created_at': '2026-11-10T17:03:49.123456+00:00',
      'updated_at': '2026-11-10T17:03:49.123456+00:00',
    };

    test('Free: the trips, and the window from since with its locked '
        'count', () {
      final history = TripHistory.fromJson({
        'trips': [row],
        'premium': false,
        'since': '2026-10-16',
        'locked': 3,
      });
      expect(
        history.window,
        RecentHistory(since: DateTime(2026, 10, 16), locked: 3),
      );
      expect(history.window.locks(DateTime(2026, 10, 15)), isTrue);
      expect(history.window.locks(DateTime(2026, 10, 16)), isFalse);
      final trip = history.trips.single;
      expect(trip.storeName, 'Kaufland');
      expect(trip.day, DateTime(2026, 11, 10));
      expect(trip.items, const [TripItem(name: 'Milch', quantity: '2 l')]);
    });

    test('Premium: all history, nothing locked', () {
      final history = TripHistory.fromJson(const {
        'trips': <Object>[],
        'premium': true,
        'since': null,
        'locked': 0,
      });
      expect(history.window, const AllHistory());
      expect(history.window.locks(DateTime(2000)), isFalse);
    });

    test('another shape is a FormatException', () {
      for (final wrong in <Object?>[
        null,
        <Object>[],
        {'trips': <Object>[], 'premium': false, 'since': null, 'locked': 0},
        {'trips': <Object>[], 'premium': true, 'locked': 0},
      ]) {
        expect(
          () => TripHistory.fromJson(wrong),
          throwsFormatException,
          reason: '$wrong',
        );
      }
    });
  });
}
