import 'package:family_groceries/analytics/events.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('the catalog is the spec list, nothing more', () {
    expect(eventCatalog.keys.toSet(), {
      'first_open',
      'household_created',
      'invite_accepted',
      'item_added',
      'item_ticked',
      'category_reordered',
      'store_reordered',
      'feedback_submitted',
    });
  });

  const allowed = <(String, Map<String, Object>)>[
    ('first_open', {}),
    ('household_created', {}),
    ('invite_accepted', {'method': 'link'}),
    ('invite_accepted', {'method': 'code'}),
    ('item_added', {'source': 'typed'}),
    ('item_added', {'source': 'spoken'}),
    (
      'item_added',
      {'source': 'suggestion', 'actor_role': 'member', 'household_size': 3},
    ),
    ('item_ticked', {'actor_role': 'owner', 'household_size': 2}),
    ('item_ticked', {}),
    ('category_reordered', {'scope': 'default'}),
    ('category_reordered', {'scope': 'store'}),
    ('store_reordered', {}),
    (
      'feedback_submitted',
      {
        'category': 'bug',
        'entry_point': 'settings',
        'screen': 'list',
        'contact_ok': true,
      },
    ),
    (
      'feedback_submitted',
      {
        'category': 'none',
        'entry_point': 'settings',
        'screen': 'account',
        'contact_ok': false,
      },
    ),
  ];
  for (final (event, properties) in allowed) {
    test('allows $event $properties', () {
      expect(() => checkEvent(event, properties), returnsNormally);
    });
  }

  const refused = <(String, Map<String, Object>, String)>[
    ('household_joined', {}, 'the old name'),
    ('purchase_completed', {}, 'server-only'),
    ('item_added', {'source': 'Hafermilch'}, 'an item name as source'),
    ('item_added', {'name': 'Hafermilch'}, 'an item name property'),
    ('item_added', {'source': 'mcp'}, 'a source the app cannot know'),
    ('item_ticked', {'store': 'Lidl'}, 'a store name'),
    ('item_ticked', {'actor_role': 'Peter'}, 'a display name as role'),
    ('item_ticked', {'household_size': 0}, 'a size below 1'),
    ('item_ticked', {'household_size': 101}, 'a size above 100'),
    ('item_ticked', {'household_size': '2'}, 'a size as text'),
    ('invite_accepted', {'method': 'ABCD2345'}, 'an invite code'),
    ('invite_accepted', {}, 'fine without method? no: see below'),
    ('category_reordered', {'scope': 'Obst & Gemüse'}, 'a category name'),
    ('store_reordered', {'ids': 'a,b'}, 'a list of ids'),
    ('first_open', {'email': 'peter@example.com'}, 'an e-mail'),
    ('feedback_submitted', {'message': 'Der Haken hängt'}, 'the note'),
    ('feedback_submitted', {'category': 'Bug'}, 'a label as category'),
    ('feedback_submitted', {'entry_point': 'shake'}, 'an entry not built'),
    ('feedback_submitted', {'screen': '/join/ABCD2345'}, 'a path as screen'),
    ('feedback_submitted', {'screen': 'Milch'}, 'an item as screen'),
    ('feedback_submitted', {'contact_ok': 'yes'}, 'contact as text'),
    ('feedback_submitted', {'email': 'max@gmail.com'}, 'an e-mail'),
  ];
  for (final (event, properties, why) in refused) {
    if (event == 'invite_accepted' && properties.isEmpty) {
      continue;
    }
    test('refuses $event with $why', () {
      expect(() => checkEvent(event, properties), throwsA(isA<RefusedEvent>()));
    });
  }

  test('a refusal never repeats the value', () {
    try {
      checkEvent('item_added', {'source': 'Hafermilch'});
      fail('not refused');
    } on RefusedEvent catch (e) {
      expect('$e', isNot(contains('Hafermilch')));
    }
  });

  test('a free-text property can only be added as an explicit rule', () {
    for (final rules in eventCatalog.values) {
      for (final rule in rules.values) {
        expect(
          rule,
          isNot(isA<OneOf>().having((r) => r.values, 'values', isEmpty)),
        );
      }
    }
  });
}
