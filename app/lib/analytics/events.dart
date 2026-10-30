/// The analytics event catalog (docs/ANALYTICS.md): every event the app may
/// send and, per event, every property it may carry. Anything not listed
/// here is refused before it reaches the queue, so an item name, a store
/// name or free text cannot slip into PostHog through a new call site.
///
/// To add an event (jobs 21 and 22 do): add its name and its properties to
/// [eventCatalog], each with a [PropertyRule] that admits only the values
/// it needs, add a case to test/analytics/events_test.dart, and list it in
/// docs/ANALYTICS.md.
library;

import 'package:family_groceries/app/router.dart' show screenNames;

/// Where an added item came from, as the app knows it.
enum AddSource() {
  /// Typed into the add field and taken as typed (Enter or the first row).
  typed,

  /// Dictated in the app and split on the server.
  spoken,

  /// A row the app suggested: bought before, a pack or size, a brand, a
  /// dictionary word, a due usual, or a re-add from recently used.
  suggestion,
}

/// Which order a category reorder changed; [wire] is what is sent.
enum ReorderScope(final String wire) {
  /// The household's default (route) order, used without a store.
  route('default'),

  /// One store's layout.
  store('store'),
}

/// How a join reached the app: `link` when the code came from an invite
/// link (`/join/<code>` or `?invite=`), `code` when it was typed.
enum JoinMethod() {
  link,
  code,
}

/// One allowed property: a check its value must pass.
sealed class const PropertyRule();

/// One of a fixed set of short strings.
final class const OneOf(final Set<String> values) extends PropertyRule;

/// A whole number in `[min, max]`.
final class const IntIn(final int min, final int max) extends PropertyRule;

/// True or false.
final class const IsBool() extends PropertyRule;

const _roles = OneOf({'owner', 'member'});
const _householdSize = IntIn(1, 100);

/// Event name to its allowed properties. An event not in here is refused;
/// so is a property not listed for it.
final eventCatalog = <String, Map<String, PropertyRule>>{
  'first_open': const {},
  'household_created': const {},
  'invite_accepted': {'method': _namesOf(JoinMethod.values)},
  'item_added': {
    'source': _namesOf(AddSource.values),
    'actor_role': _roles,
    'household_size': _householdSize,
  },
  'item_ticked': const {'actor_role': _roles, 'household_size': _householdSize},
  'category_reordered': {
    'scope': OneOf({for (final s in ReorderScope.values) s.wire}),
  },
  'store_reordered': const {},
  // Job 21: after the server took a note, once per note. Never its text.
  'feedback_submitted': {
    'category': const OneOf({'bug', 'idea', 'other', 'none'}),
    'entry_point': const OneOf({'settings'}),
    'screen': const OneOf(screenNames),
    'contact_ok': const IsBool(),
  },
};

OneOf _namesOf(List<Enum> values) => OneOf({for (final v in values) v.name});

/// Why [checkEvent] refused an event; names the event and the property,
/// never the value.
final class const RefusedEvent(final String reason) implements Exception {
  @override
  String toString() => 'RefusedEvent: $reason';
}

/// Throws [RefusedEvent] unless [event] is in [eventCatalog] and each of
/// [properties] is listed for it and passes its rule.
void checkEvent(String event, Map<String, Object> properties) {
  final allowed = eventCatalog[event];
  if (allowed == null) {
    throw RefusedEvent('unknown event $event');
  }
  for (final MapEntry(:key, :value) in properties.entries) {
    final rule = allowed[key];
    if (rule == null) {
      throw RefusedEvent('$event does not carry $key');
    }
    if (!_passes(rule, value)) {
      throw RefusedEvent('$event.$key has a value its rule refuses');
    }
  }
}

bool _passes(PropertyRule rule, Object value) => switch (rule) {
  OneOf(:final values) => value is String && values.contains(value),
  IntIn(:final min, :final max) => value is int && value >= min && value <= max,
  IsBool() => value is bool,
};

/// A random (version 4) UUID, lower case.
final uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

/// Any UUID, lower case: household ids come from Postgres.
final anyUuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
);

/// An app version like `0.1.0+1023`: digits, dots and a build number.
final versionPattern = RegExp(
  r'^[0-9]{1,4}(\.[0-9]{1,4}){0,3}(\+[0-9]{1,9})?$',
);

/// The platforms the app reports.
const platforms = {'ios', 'android', 'web', 'macos', 'linux', 'windows'};
