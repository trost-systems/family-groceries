import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/category_names.dart';
import 'package:family_groceries/list/model.dart';

/// The small leading icon of a row: an emoji for the item when its name
/// says what it is, else its category's.
String itemIcon(Item item, Category? category) => nameIcon(item.name, category);

/// The icon for a name, as [itemIcon]: the add sheet's rows have no item.
String nameIcon(String name, Category? category) {
  for (final word in foldName(name).split(RegExp('[^a-z]+'))) {
    if (_englishWords[word] case final emoji?) {
      return emoji;
    }
    for (final (ending, emoji) in _items) {
      if (word.endsWith(ending)) {
        return emoji;
      }
    }
  }
  return categoryIcon(category);
}

/// A category's emoji: the one its name starts with, else the seeded
/// category's, else a basket.
String categoryIcon(Category? category) {
  if (category == null) {
    return '🧺';
  }
  final lead = _leadingSymbols.firstMatch(category.name)?.group(0)?.trim();
  if (lead != null && lead.isNotEmpty) {
    return lead;
  }
  return _categories[category.seedKey] ?? '🧺';
}

/// A category's name for its divider, without a leading emoji.
String categoryLabel(Category category, AppLocalizations l10n) {
  final name = categoryName(category, l10n);
  final label = name.replaceFirst(_leadingSymbols, '').trim();
  return label.isEmpty ? name : label;
}

final _leadingSymbols = RegExp(r'^[^\p{L}\p{N}]+', unicode: true);

const _categories = {
  'produce': '🥕',
  'bakery': '🥖',
  'chilled': '🥛',
  'meat': '🥩',
  'pantry': '🥫',
  'sweets': '🍫',
  'drinks': '🧃',
  'frozen': '🧊',
  'household': '🧽',
  'drugstore': '🧴',
  'other': '🛒',
};

/// Word endings, folded as by [foldName], so compounds match too
/// ("Vollmilch"); longer endings first where one contains another.
const _items = [
  ('feuchttuecher', '🧻'),
  ('klopapier', '🧻'),
  ('toilettenpapier', '🧻'),
  ('kuechenrolle', '🧻'),
  ('taschentuecher', '🤧'),
  ('zahnpasta', '🪥'),
  ('zahnbuerste', '🪥'),
  ('windeln', '👶'),
  ('shampoo', '🧴'),
  ('duschgel', '🧴'),
  ('seife', '🧼'),
  ('spuelmittel', '🧴'),
  ('waschmittel', '🧺'),
  ('schwamm', '🧽'),
  ('muellbeutel', '🗑️'),
  ('bananen', '🍌'),
  ('banane', '🍌'),
  ('aepfel', '🍎'),
  ('apfel', '🍎'),
  ('birnen', '🍐'),
  ('birne', '🍐'),
  ('zitronen', '🍋'),
  ('zitrone', '🍋'),
  ('orangen', '🍊'),
  ('trauben', '🍇'),
  ('erdbeeren', '🍓'),
  ('gurken', '🥒'),
  ('gurke', '🥒'),
  ('tomaten', '🍅'),
  ('tomate', '🍅'),
  ('kartoffeln', '🥔'),
  ('karotten', '🥕'),
  ('moehren', '🥕'),
  ('zwiebeln', '🧅'),
  ('zwiebel', '🧅'),
  ('knoblauch', '🧄'),
  ('paprika', '🫑'),
  ('salat', '🥬'),
  ('brokkoli', '🥦'),
  ('avocado', '🥑'),
  ('pilze', '🍄'),
  ('broetchen', '🥐'),
  ('brezeln', '🥨'),
  ('brezel', '🥨'),
  ('brot', '🍞'),
  ('toast', '🍞'),
  ('milch', '🥛'),
  ('kaese', '🧀'),
  ('gouda', '🧀'),
  ('butter', '🧈'),
  ('joghurt', '🥛'),
  ('eier', '🥚'),
  ('hack', '🥩'),
  ('fleisch', '🥩'),
  ('wurst', '🌭'),
  ('schinken', '🥓'),
  ('haehnchen', '🍗'),
  ('fisch', '🐟'),
  ('lachs', '🐟'),
  ('nudeln', '🍝'),
  ('spaghetti', '🍝'),
  ('reis', '🍚'),
  ('mehl', '🌾'),
  ('zucker', '🧂'),
  ('salz', '🧂'),
  ('honig', '🍯'),
  ('kaffee', '☕'),
  ('tee', '🍵'),
  ('schokolade', '🍫'),
  ('riegel', '🍫'),
  ('chips', '🍿'),
  ('kekse', '🍪'),
  ('pizza', '🍕'),
  ('eis', '🍨'),
  ('wasser', '💧'),
  ('saft', '🧃'),
  ('cola', '🥤'),
  ('bier', '🍺'),
  ('wein', '🍷'),
];

/// English names as whole words: English writes compounds apart ("oat
/// milk"), and an ending would misfire ("pineapple", "quince", "beer" in
/// "Himbeer").
const _englishWords = {
  'toothpaste': '🪥',
  'toothbrush': '🪥',
  'tissues': '🤧',
  'diapers': '👶',
  'nappies': '👶',
  'soap': '🧼',
  'detergent': '🧺',
  'sponge': '🧽',
  'bananas': '🍌',
  'banana': '🍌',
  'apples': '🍎',
  'apple': '🍎',
  'pears': '🍐',
  'pear': '🍐',
  'lemons': '🍋',
  'lemon': '🍋',
  'oranges': '🍊',
  'orange': '🍊',
  'grapes': '🍇',
  'grape': '🍇',
  'strawberries': '🍓',
  'strawberry': '🍓',
  'cucumbers': '🥒',
  'cucumber': '🥒',
  'tomatoes': '🍅',
  'tomato': '🍅',
  'potatoes': '🥔',
  'potato': '🥔',
  'carrots': '🥕',
  'carrot': '🥕',
  'onions': '🧅',
  'onion': '🧅',
  'garlic': '🧄',
  'peppers': '🫑',
  'pepper': '🫑',
  'lettuce': '🥬',
  'broccoli': '🥦',
  'mushrooms': '🍄',
  'pretzels': '🥨',
  'pretzel': '🥨',
  'bread': '🍞',
  'milk': '🥛',
  'cheese': '🧀',
  'yogurt': '🥛',
  'yoghurt': '🥛',
  'eggs': '🥚',
  'egg': '🥚',
  'mince': '🥩',
  'meat': '🥩',
  'sausages': '🌭',
  'sausage': '🌭',
  'bacon': '🥓',
  'chicken': '🍗',
  'fish': '🐟',
  'salmon': '🐟',
  'pasta': '🍝',
  'rice': '🍚',
  'flour': '🌾',
  'sugar': '🧂',
  'salt': '🧂',
  'honey': '🍯',
  'coffee': '☕',
  'tea': '🍵',
  'chocolate': '🍫',
  'crisps': '🍿',
  'cookies': '🍪',
  'cookie': '🍪',
  'biscuits': '🍪',
  'biscuit': '🍪',
  'water': '💧',
  'juice': '🧃',
  'beer': '🍺',
  'wine': '🍷',
};
