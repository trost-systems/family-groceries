import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/siri/siri_channel.dart';
import 'package:family_groceries/siri/siri_suggestions.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_siri_channel.dart';

class Lists() extends Cubit<ListState> {
  this : super(const ListState());

  void set(ListState state) => emit(state);
}

Item item(
  String name,
  ItemStatus status, {
  int boughtDay = 1,
  String? canonicalKey,
}) => Item(
  id: name,
  name: name,
  status: status,
  createdAt: DateTime(2026, 10),
  updatedAt: DateTime(2026, 10),
  boughtAt: status == ItemStatus.bought ? DateTime(2026, 10, boughtDay) : null,
  canonicalKey: canonicalKey,
);

List<String> names(ListState state) => [
  for (final suggestion in siriSuggestions(state)) suggestion.name,
];

ListState loaded({
  List<String> usuals = const [],
  List<Item> items = const [],
}) => ListState(
  loaded: true,
  usuals: [for (final name in usuals) Usual(name: name, due: false)],
  server: {for (final i in items) i.id: i},
);

void main() {
  test('usuals first, then the list, then the latest bought, once each', () {
    expect(
      names(
        loaded(
          usuals: ['Milch', 'Eier'],
          items: [
            item('Brot', ItemStatus.bought),
            item('Äpfel', ItemStatus.bought, boughtDay: 3),
            item('Butter', ItemStatus.active),
            item('milch', ItemStatus.bought, boughtDay: 2),
          ],
        ),
      ),
      ['Milch', 'Eier', 'Butter', 'Äpfel', 'Brot'],
    );
  });

  test('at most 50 names', () {
    final fifty = names(
      loaded(usuals: [for (var i = 0; i < 80; i++) 'Ding $i']),
    );
    expect(fifty, hasLength(50));
    expect(fifty.last, 'Ding 49');
  });

  test("the household's other names for an item are its synonyms", () {
    expect(
      siriSuggestions(
        loaded(
          usuals: ['Karotten', 'Milch'],
          items: [
            item('Möhren', ItemStatus.active, canonicalKey: 'mohr'),
            item('Karotten', ItemStatus.bought, canonicalKey: 'mohr'),
            item('Mohrrüben', ItemStatus.bought, canonicalKey: 'mohr'),
            item('Gelbe Rüben', ItemStatus.bought, canonicalKey: 'mohr'),
            item('Milch', ItemStatus.bought, canonicalKey: 'milch'),
            item('Brot', ItemStatus.active),
          ],
        ),
      ),
      [
        const SiriSuggestion('Karotten', synonyms: ['Möhren', 'Mohrrüben']),
        const SiriSuggestion('Milch'),
        const SiriSuggestion('Brot'),
      ],
      reason: 'one suggestion per canonical key, at most two synonyms',
    );
  });

  test('sends after a quiet moment, and only changes', () {
    fakeAsync((async) {
      final channel = FakeSiriChannel();
      final lists = Lists();
      final feed = SiriSuggestions(channel, lists);

      lists.set(const ListState(connection: .online));
      async.elapse(const Duration(seconds: 5));
      expect(channel.sentNames, isEmpty, reason: 'not loaded yet');

      lists.set(loaded(usuals: ['Milch']));
      async.elapse(const Duration(milliseconds: 500));
      lists.set(loaded(usuals: ['Milch', 'Eier']));
      async.elapse(const Duration(seconds: 1));
      expect(channel.sentNames, isEmpty, reason: 'debounced');
      async.elapse(const Duration(seconds: 1));
      expect(channel.sentNames, [
        ['Milch', 'Eier'],
      ]);

      lists.set(loaded(usuals: ['Milch', 'Eier']));
      async.elapse(const Duration(seconds: 5));
      expect(channel.sentNames, hasLength(1), reason: 'same names');

      lists.set(loaded(usuals: ['Brot']));
      async.elapse(const Duration(seconds: 5));
      expect(channel.sentNames.last, ['Brot']);

      unawaited(feed.close());
      unawaited(lists.close());
      async.flushMicrotasks();
    });
  });

  test('without the Swift side nothing breaks', () {
    fakeAsync((async) {
      final channel = FakeSiriChannel()..missing = true;
      final lists = Lists();
      final feed = SiriSuggestions(channel, lists);
      lists.set(loaded(usuals: ['Milch']));
      async.elapse(const Duration(seconds: 5));
      expect(channel.sentNames, isEmpty);
      unawaited(feed.close());
      unawaited(lists.close());
      async.flushMicrotasks();
    });
  });
}
