import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter/widgets.dart';

/// A list's name in the UI language. The list a household starts with is
/// stored as „Einkaufsliste“ (`lists.seed_key` `main`); while it has that
/// name it shows the UI language's. A renamed or created list shows what
/// the household wrote.
String listName(HouseholdList list, AppLocalizations l10n) =>
    list.seedKey == 'main' && list.name == _german.listMain
    ? l10n.listMain
    : list.name;

final _german = lookupAppLocalizations(const Locale('de'));
