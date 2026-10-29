import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/widgets.dart';

/// A category's name in the UI language. Seeded categories are stored
/// with their German names (`public.seed_household`); one the household
/// has not renamed shows its name for the UI language. A renamed or
/// created one shows what the household wrote.
String categoryName(Category category, AppLocalizations l10n) {
  final seeded = _seeded[category.seedKey];
  if (seeded == null || category.name != seeded(_german)) {
    return category.name;
  }
  return seeded(l10n);
}

final _german = lookupAppLocalizations(const Locale('de'));

final Map<String, String Function(AppLocalizations)> _seeded = {
  'produce': (l) => l.categoryProduce,
  'bakery': (l) => l.categoryBakery,
  'chilled': (l) => l.categoryChilled,
  'meat': (l) => l.categoryMeat,
  'pantry': (l) => l.categoryPantry,
  'sweets': (l) => l.categorySweets,
  'drinks': (l) => l.categoryDrinks,
  'frozen': (l) => l.categoryFrozen,
  'household': (l) => l.categoryHousehold,
  'drugstore': (l) => l.categoryDrugstore,
  'other': (l) => l.categoryOther,
};
