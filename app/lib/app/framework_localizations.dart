import 'package:family_groceries/app/framework_date_data.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_custom.dart';
import 'package:intl/intl.dart' as intl;

/// The app's strings plus Material's, Cupertino's and the widgets' in the
/// app's languages only.
///
/// `GlobalMaterialLocalizations.delegate` and its siblings pick one of about
/// 80 locales at runtime, so a build keeps all their strings and date data
/// (job 133: about 96 KB of the web build). These build the same objects for
/// de and en, with the arguments flutter_localizations' delegates pass.
const List<LocalizationsDelegate<Object?>> appLocalizationsDelegates = [
  AppLocalizations.delegate,
  _MaterialDelegate(),
  _CupertinoDelegate(),
  _WidgetsDelegate(),
];

AppLanguage? _language(Locale locale) =>
    AppLanguage.byCode(locale.languageCode);

var _dateDataLoaded = false;

/// What `loadDateIntlDataIfNotLoaded` does for every locale, for de and en.
void _loadDateData() {
  if (_dateDataLoaded) {
    return;
  }
  for (final MapEntry(key: locale, value: symbols) in dateSymbols.entries) {
    initializeDateFormattingCustom(
      locale: locale,
      symbols: symbols,
      patterns: datePatterns[locale],
    );
  }
  _dateDataLoaded = true;
}

/// The locale name intl's date formats get: the full name when intl has date
/// data for it, else the language, as the SDK's delegates choose.
String _dateLocale(Locale locale) {
  final name = intl.Intl.canonicalizedLocale(locale.toString());
  return intl.DateFormat.localeExists(name) ? name : locale.languageCode;
}

class const _MaterialDelegate()
    extends LocalizationsDelegate<MaterialLocalizations> {
  @override
  bool isSupported(Locale locale) => _language(locale) != null;

  @override
  Future<MaterialLocalizations> load(Locale locale) {
    _loadDateData();
    final date = _dateLocale(locale);
    final name = intl.Intl.canonicalizedLocale(locale.toString());
    final number = intl.NumberFormat.localeExists(name)
        ? name
        : locale.languageCode;
    final translation = switch (_language(locale)!) {
      AppLanguage.de => MaterialLocalizationDe.new,
      AppLanguage.en => MaterialLocalizationEn.new,
    };
    return SynchronousFuture(
      translation(
        fullYearFormat: intl.DateFormat.y(date),
        compactDateFormat: intl.DateFormat.yMd(date),
        shortDateFormat: intl.DateFormat.yMMMd(date),
        mediumDateFormat: intl.DateFormat.MMMEd(date),
        longDateFormat: intl.DateFormat.yMMMMEEEEd(date),
        yearMonthFormat: intl.DateFormat.yMMMM(date),
        shortMonthDayFormat: intl.DateFormat.MMMd(date),
        decimalFormat: intl.NumberFormat.decimalPattern(number),
        twoDigitZeroPaddedFormat: intl.NumberFormat('00', number),
      ),
    );
  }

  @override
  bool shouldReload(_MaterialDelegate old) => false;
}

class const _CupertinoDelegate()
    extends LocalizationsDelegate<CupertinoLocalizations> {
  @override
  bool isSupported(Locale locale) => _language(locale) != null;

  @override
  Future<CupertinoLocalizations> load(Locale locale) {
    _loadDateData();
    final date = _dateLocale(locale);
    final translation = switch (_language(locale)!) {
      AppLanguage.de => CupertinoLocalizationDe.new,
      AppLanguage.en => CupertinoLocalizationEn.new,
    };
    return SynchronousFuture(
      translation(
        fullYearFormat: intl.DateFormat.y(date),
        dayFormat: intl.DateFormat.d(date),
        weekdayFormat: intl.DateFormat.E(date),
        mediumDateFormat: intl.DateFormat.MMMEd(date),
        singleDigitHourFormat: intl.DateFormat('HH', date),
        singleDigitMinuteFormat: intl.DateFormat.m(date),
        doubleDigitMinuteFormat: intl.DateFormat('mm', date),
        singleDigitSecondFormat: intl.DateFormat.s(date),
        decimalFormat: intl.NumberFormat.decimalPattern(date),
      ),
    );
  }

  @override
  bool shouldReload(_CupertinoDelegate old) => false;
}

class const _WidgetsDelegate()
    extends LocalizationsDelegate<WidgetsLocalizations> {
  @override
  bool isSupported(Locale locale) => _language(locale) != null;

  @override
  Future<WidgetsLocalizations> load(Locale locale) =>
      SynchronousFuture(switch (_language(locale)!) {
        AppLanguage.de => const WidgetsLocalizationDe(),
        AppLanguage.en => const WidgetsLocalizationEn(),
      });

  @override
  bool shouldReload(_WidgetsDelegate old) => false;
}
