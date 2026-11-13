import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/log/model.dart';
import 'package:family_groceries/log/trip_repository.dart';

/// Thursday, 12 November 2026, mid-morning: the fixed "now" of the log's
/// tests.
final now = DateTime(2026, 11, 12, 10, 30);
DateTime clock() => now;

/// The household's stores in their order.
const lidl = Store(id: 'lidl', name: 'Lidl', sortOrder: 10);
const rewe = Store(id: 'rewe', name: 'Rewe', sortOrder: 20);
const dm = Store(id: 'dm', name: 'dm', sortOrder: 30);
const stores = [lidl, rewe, dm];

var _ids = 0;

/// A trip on the day [y]-[m]-[d] at [store]; later calls are saved
/// later.
Trip trip(
  int y,
  int m,
  int d, {
  String? store,
  String? storeName,
  List<String> items = const ['Milch'],
  String? id,
}) {
  final n = ++_ids;
  return Trip(
    id: id ?? 't$n',
    storeId: store,
    storeName:
        storeName ?? stores.where((s) => s.id == store).firstOrNull?.name,
    day: DateTime(y, m, d),
    items: [for (final name in items) TripItem(name: name)],
    createdAt: DateTime(2026).add(Duration(minutes: n)),
  );
}

/// An in-memory `trips` table read the way `trip_history` reads it: all of
/// it with [premium], else the 28 days up to the asked today. [fail] makes
/// every call throw; [loseAnswer] makes the next save commit, then throw, as
/// a response lost on the way back would.
class FakeTrips([List<Trip> trips = const [], var bool premium = true])
    implements TripRepository {
  final rows = <String, Trip>{for (final t in trips) t.id: t};
  final saved = <Trip>[];
  final deleted = <String>[];
  var fail = false;
  var loseAnswer = false;
  var fetches = 0;

  @override
  Future<TripHistory> fetch(DateTime today) async {
    fetches++;
    if (fail) {
      throw Exception('offline');
    }
    final all = [...rows.values]..sort(newestFirst);
    if (premium) {
      return TripHistory(trips: all, window: const AllHistory());
    }
    final since = DateTime(today.year, today.month, today.day - 27);
    return TripHistory(
      trips: [
        for (final t in all)
          if (!t.day.isBefore(since)) t,
      ],
      window: RecentHistory(
        since: since,
        locked: all.where((t) => t.day.isBefore(since)).length,
      ),
    );
  }

  @override
  Future<void> save(Trip trip) async {
    if (fail) {
      throw Exception('offline');
    }
    saved.add(trip);
    rows[trip.id] = trip;
    if (loseAnswer) {
      loseAnswer = false;
      throw Exception('connection lost');
    }
  }

  @override
  Future<void> delete(String id) async {
    if (fail) {
      throw Exception('offline');
    }
    deleted.add(id);
    rows.remove(id);
  }
}
