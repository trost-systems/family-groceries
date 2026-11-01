import { assertEquals } from '@std/assert';
import { maxItems } from './parse.ts';
import { parseEnglish, spokenEnglish } from './parse_en.ts';

/** Sentence -> items as read back ("2 cucumbers"). */
const cases: [string, string[]][] = [
  ['milk, eggs and bread', ['milk', 'eggs', 'bread']],
  ['milk, eggs, and bread', ['milk', 'eggs', 'bread']],
  ['Milk, eggs and bread.', ['Milk', 'eggs', 'bread']],
  ['two cucumbers and a pack of eggs', ['2 cucumbers', '1 pack of eggs']],
  ['add milk to Hummlist', ['milk']],
  ['Add milk to my Hummlist', ['milk']],
  ['add milk to my shopping list', ['milk']],
  ['put eggs on the list please', ['eggs']],
  ['Hey Siri, add milk', ['milk']],
  ['we need milk plus eggs', ['milk', 'eggs']],
  ['I need bread, also butter', ['bread', 'butter']],
  ['cheese as well as crackers', ['cheese', 'crackers']],
  ["we're out of coffee", ['coffee']],
  ["don't forget the bananas", ['bananas']],
  ['some apples', ['apples']],
  ['an apple', ['apple']],
  ['a couple of lemons', ['a couple of lemons']],
  ['a few onions', ['a few onions']],
  ['twelve eggs', ['12 eggs']],
  ['a dozen eggs', ['1 dozen eggs']],
  ['two dozen eggs', ['2 dozen eggs']],
  ['3 bottles of wine', ['3 bottles of wine']],
  ['one bottle of wine', ['1 bottle of wine']],
  ['2 kg of potatoes', ['2 kg of potatoes']],
  ['500g flour', ['500 g of flour']],
  ['1.5 liters of milk', ['1.5 l of milk']],
  ['two litres of juice', ['2 l of juice']],
  ['a loaf of bread and two packs of butter', ['1 loaf of bread', '2 packs of butter']],
  ['mac and cheese', ['mac and cheese']],
  ['mac and cheese and milk', ['mac and cheese', 'milk']],
  ['half and half, salt and pepper', ['half and half', 'salt', 'pepper']],
  ['milk and milk', ['milk']],
  ['milk & eggs; bread', ['milk', 'eggs', 'bread']],
  ['Milk', ['Milk']],
  ['please, thanks', []],
  ['um uh', []],
  ['add to Hummlist', []],
  ['12', []],
  ['', []],
];

for (const [sentence, expected] of cases) {
  Deno.test(`EN "${sentence}" -> ${JSON.stringify(expected)}`, () => {
    assertEquals(parseEnglish(sentence).map(spokenEnglish), expected);
  });
}

Deno.test('EN keeps the quantity apart from the name', () => {
  assertEquals(parseEnglish('two cucumbers and a pack of eggs'), [
    { name: 'cucumbers', quantity: '2' },
    { name: 'eggs', quantity: '1 pack' },
  ]);
});

Deno.test('EN stops at the item cap', () => {
  const sentence = Array.from({ length: 40 }, (_, i) => `thing${i}`).join(', ');
  assertEquals(parseEnglish(sentence).length, maxItems);
  assertEquals(parseEnglish(sentence, maxItems + 1).length, maxItems + 1);
});
