import 'package:family_groceries/app/framework_localizations.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';

final _dates = [
  DateTime(2026, 11, 5),
  DateTime(2027, 1, 31),
  DateTime(1999, 6, 9),
];
const _times = [
  TimeOfDay(hour: 15, minute: 7),
  TimeOfDay(hour: 0, minute: 5),
  TimeOfDay(hour: 12, minute: 30),
];
const _counts = [0, 1, 2, 5, 13, 1234567];

/// Everything [MaterialLocalizations] answers, for fixed inputs.
Map<String, Object?> _material(MaterialLocalizations m) => {
  'openAppDrawerTooltip': m.openAppDrawerTooltip,
  'backButtonTooltip': m.backButtonTooltip,
  'clearButtonTooltip': m.clearButtonTooltip,
  'closeButtonTooltip': m.closeButtonTooltip,
  'deleteButtonTooltip': m.deleteButtonTooltip,
  'moreButtonTooltip': m.moreButtonTooltip,
  'nextMonthTooltip': m.nextMonthTooltip,
  'previousMonthTooltip': m.previousMonthTooltip,
  'firstPageTooltip': m.firstPageTooltip,
  'lastPageTooltip': m.lastPageTooltip,
  'nextPageTooltip': m.nextPageTooltip,
  'previousPageTooltip': m.previousPageTooltip,
  'showMenuTooltip': m.showMenuTooltip,
  'licensesPageTitle': m.licensesPageTitle,
  'rowsPerPageTitle': m.rowsPerPageTitle,
  'cancelButtonLabel': m.cancelButtonLabel,
  'closeButtonLabel': m.closeButtonLabel,
  'continueButtonLabel': m.continueButtonLabel,
  'copyButtonLabel': m.copyButtonLabel,
  'cutButtonLabel': m.cutButtonLabel,
  'scanTextButtonLabel': m.scanTextButtonLabel,
  'okButtonLabel': m.okButtonLabel,
  'pasteButtonLabel': m.pasteButtonLabel,
  'selectAllButtonLabel': m.selectAllButtonLabel,
  'lookUpButtonLabel': m.lookUpButtonLabel,
  'searchWebButtonLabel': m.searchWebButtonLabel,
  'shareButtonLabel': m.shareButtonLabel,
  'viewLicensesButtonLabel': m.viewLicensesButtonLabel,
  'anteMeridiemAbbreviation': m.anteMeridiemAbbreviation,
  'postMeridiemAbbreviation': m.postMeridiemAbbreviation,
  'timePickerHourModeAnnouncement': m.timePickerHourModeAnnouncement,
  'timePickerMinuteModeAnnouncement': m.timePickerMinuteModeAnnouncement,
  'modalBarrierDismissLabel': m.modalBarrierDismissLabel,
  'menuDismissLabel': m.menuDismissLabel,
  'drawerLabel': m.drawerLabel,
  'popupMenuLabel': m.popupMenuLabel,
  'menuBarMenuLabel': m.menuBarMenuLabel,
  'dialogLabel': m.dialogLabel,
  'alertDialogLabel': m.alertDialogLabel,
  'searchFieldLabel': m.searchFieldLabel,
  'currentDateLabel': m.currentDateLabel,
  'selectedDateLabel': m.selectedDateLabel,
  'scrimLabel': m.scrimLabel,
  'bottomSheetLabel': m.bottomSheetLabel,
  'scriptCategory': m.scriptCategory,
  'narrowWeekdays': m.narrowWeekdays,
  'firstDayOfWeekIndex': m.firstDayOfWeekIndex,
  'dateSeparator': m.dateSeparator,
  'dateHelpText': m.dateHelpText,
  'selectYearSemanticsLabel': m.selectYearSemanticsLabel,
  'unspecifiedDate': m.unspecifiedDate,
  'unspecifiedDateRange': m.unspecifiedDateRange,
  'dateInputLabel': m.dateInputLabel,
  'dateRangeStartLabel': m.dateRangeStartLabel,
  'dateRangeEndLabel': m.dateRangeEndLabel,
  'invalidDateFormatLabel': m.invalidDateFormatLabel,
  'invalidDateRangeLabel': m.invalidDateRangeLabel,
  'dateOutOfRangeLabel': m.dateOutOfRangeLabel,
  'saveButtonLabel': m.saveButtonLabel,
  'datePickerHelpText': m.datePickerHelpText,
  'dateRangePickerHelpText': m.dateRangePickerHelpText,
  'calendarModeButtonLabel': m.calendarModeButtonLabel,
  'inputDateModeButtonLabel': m.inputDateModeButtonLabel,
  'timePickerDialHelpText': m.timePickerDialHelpText,
  'timePickerInputHelpText': m.timePickerInputHelpText,
  'timePickerHourLabel': m.timePickerHourLabel,
  'timePickerMinuteLabel': m.timePickerMinuteLabel,
  'invalidTimeLabel': m.invalidTimeLabel,
  'dialModeButtonLabel': m.dialModeButtonLabel,
  'inputTimeModeButtonLabel': m.inputTimeModeButtonLabel,
  'signedInLabel': m.signedInLabel,
  'hideAccountsLabel': m.hideAccountsLabel,
  'showAccountsLabel': m.showAccountsLabel,
  'expandedIconTapHint': m.expandedIconTapHint,
  'collapsedIconTapHint': m.collapsedIconTapHint,
  'expansionTileExpandedHint': m.expansionTileExpandedHint,
  'expansionTileCollapsedHint': m.expansionTileCollapsedHint,
  'expansionTileExpandedTapHint': m.expansionTileExpandedTapHint,
  'expansionTileCollapsedTapHint': m.expansionTileCollapsedTapHint,
  'expandedHint': m.expandedHint,
  'collapsedHint': m.collapsedHint,
  'refreshIndicatorSemanticLabel': m.refreshIndicatorSemanticLabel,
  'keyboardKeyAlt': m.keyboardKeyAlt,
  'keyboardKeyAltGraph': m.keyboardKeyAltGraph,
  'keyboardKeyBackspace': m.keyboardKeyBackspace,
  'keyboardKeyCapsLock': m.keyboardKeyCapsLock,
  'keyboardKeyChannelDown': m.keyboardKeyChannelDown,
  'keyboardKeyChannelUp': m.keyboardKeyChannelUp,
  'keyboardKeyControl': m.keyboardKeyControl,
  'keyboardKeyDelete': m.keyboardKeyDelete,
  'keyboardKeyEject': m.keyboardKeyEject,
  'keyboardKeyEnd': m.keyboardKeyEnd,
  'keyboardKeyEscape': m.keyboardKeyEscape,
  'keyboardKeyFn': m.keyboardKeyFn,
  'keyboardKeyHome': m.keyboardKeyHome,
  'keyboardKeyInsert': m.keyboardKeyInsert,
  'keyboardKeyMeta': m.keyboardKeyMeta,
  'keyboardKeyMetaMacOs': m.keyboardKeyMetaMacOs,
  'keyboardKeyMetaWindows': m.keyboardKeyMetaWindows,
  'keyboardKeyNumLock': m.keyboardKeyNumLock,
  'keyboardKeyNumpad1': m.keyboardKeyNumpad1,
  'keyboardKeyNumpad2': m.keyboardKeyNumpad2,
  'keyboardKeyNumpad3': m.keyboardKeyNumpad3,
  'keyboardKeyNumpad4': m.keyboardKeyNumpad4,
  'keyboardKeyNumpad5': m.keyboardKeyNumpad5,
  'keyboardKeyNumpad6': m.keyboardKeyNumpad6,
  'keyboardKeyNumpad7': m.keyboardKeyNumpad7,
  'keyboardKeyNumpad8': m.keyboardKeyNumpad8,
  'keyboardKeyNumpad9': m.keyboardKeyNumpad9,
  'keyboardKeyNumpad0': m.keyboardKeyNumpad0,
  'keyboardKeyNumpadAdd': m.keyboardKeyNumpadAdd,
  'keyboardKeyNumpadComma': m.keyboardKeyNumpadComma,
  'keyboardKeyNumpadDecimal': m.keyboardKeyNumpadDecimal,
  'keyboardKeyNumpadDivide': m.keyboardKeyNumpadDivide,
  'keyboardKeyNumpadEnter': m.keyboardKeyNumpadEnter,
  'keyboardKeyNumpadEqual': m.keyboardKeyNumpadEqual,
  'keyboardKeyNumpadMultiply': m.keyboardKeyNumpadMultiply,
  'keyboardKeyNumpadParenLeft': m.keyboardKeyNumpadParenLeft,
  'keyboardKeyNumpadParenRight': m.keyboardKeyNumpadParenRight,
  'keyboardKeyNumpadSubtract': m.keyboardKeyNumpadSubtract,
  'keyboardKeyPageDown': m.keyboardKeyPageDown,
  'keyboardKeyPageUp': m.keyboardKeyPageUp,
  'keyboardKeyPower': m.keyboardKeyPower,
  'keyboardKeyPowerOff': m.keyboardKeyPowerOff,
  'keyboardKeyPrintScreen': m.keyboardKeyPrintScreen,
  'keyboardKeyScrollLock': m.keyboardKeyScrollLock,
  'keyboardKeySelect': m.keyboardKeySelect,
  'keyboardKeyShift': m.keyboardKeyShift,
  'keyboardKeySpace': m.keyboardKeySpace,
  'aboutListTileTitle': m.aboutListTileTitle('Hummlist'),
  'scrimOnTapHint': m.scrimOnTapHint('Hummlist'),
  'dateRangeStartDateSemanticLabel': m.dateRangeStartDateSemanticLabel('X'),
  'dateRangeEndDateSemanticLabel': m.dateRangeEndDateSemanticLabel('X'),
  for (final n in _counts) ...{
    'licensesPackageDetailText($n)': m.licensesPackageDetailText(n),
    'selectedRowCountTitle($n)': m.selectedRowCountTitle(n),
    'remainingTextFieldCharacterCount($n)': m.remainingTextFieldCharacterCount(
      n,
    ),
    'formatDecimal($n)': m.formatDecimal(n),
    'tabLabel($n)': m.tabLabel(tabIndex: n + 1, tabCount: n + 2),
  },
  'pageRowsInfoTitle': m.pageRowsInfoTitle(11, 20, 1234, false),
  'pageRowsInfoTitle approximate': m.pageRowsInfoTitle(11, 20, 1234, true),
  for (final d in _dates) ...{
    'formatYear($d)': m.formatYear(d),
    'formatCompactDate($d)': m.formatCompactDate(d),
    'formatShortDate($d)': m.formatShortDate(d),
    'formatMediumDate($d)': m.formatMediumDate(d),
    'formatFullDate($d)': m.formatFullDate(d),
    'formatMonthYear($d)': m.formatMonthYear(d),
    'formatShortMonthDay($d)': m.formatShortMonthDay(d),
    'parseCompactDate($d)': m.parseCompactDate(m.formatCompactDate(d)),
  },
  'parseCompactDate(en)': m.parseCompactDate('11/5/2026'),
  'parseCompactDate(de)': m.parseCompactDate('5.11.2026'),
  for (final t in _times) ...{
    'formatMinute($t)': m.formatMinute(t),
    for (final h24 in [false, true]) ...{
      'timeOfDayFormat($h24)': m.timeOfDayFormat(alwaysUse24HourFormat: h24),
      'formatHour($t, $h24)': m.formatHour(t, alwaysUse24HourFormat: h24),
      'formatTimeOfDay($t, $h24)': m.formatTimeOfDay(
        t,
        alwaysUse24HourFormat: h24,
      ),
    },
  },
};

/// Everything [CupertinoLocalizations] answers, for fixed inputs.
Map<String, Object?> _cupertino(CupertinoLocalizations c) => {
  'datePickerDateOrder': c.datePickerDateOrder,
  'datePickerDateTimeOrder': c.datePickerDateTimeOrder,
  'anteMeridiemAbbreviation': c.anteMeridiemAbbreviation,
  'postMeridiemAbbreviation': c.postMeridiemAbbreviation,
  'todayLabel': c.todayLabel,
  'alertDialogLabel': c.alertDialogLabel,
  'timerPickerHourLabels': c.timerPickerHourLabels,
  'timerPickerMinuteLabels': c.timerPickerMinuteLabels,
  'timerPickerSecondLabels': c.timerPickerSecondLabels,
  'cutButtonLabel': c.cutButtonLabel,
  'copyButtonLabel': c.copyButtonLabel,
  'pasteButtonLabel': c.pasteButtonLabel,
  'clearButtonLabel': c.clearButtonLabel,
  'noSpellCheckReplacementsLabel': c.noSpellCheckReplacementsLabel,
  'selectAllButtonLabel': c.selectAllButtonLabel,
  'lookUpButtonLabel': c.lookUpButtonLabel,
  'searchWebButtonLabel': c.searchWebButtonLabel,
  'shareButtonLabel': c.shareButtonLabel,
  'searchTextFieldPlaceholderLabel': c.searchTextFieldPlaceholderLabel,
  'modalBarrierDismissLabel': c.modalBarrierDismissLabel,
  'menuDismissLabel': c.menuDismissLabel,
  'cancelButtonLabel': c.cancelButtonLabel,
  'backButtonLabel': c.backButtonLabel,
  'expansionTileExpandedHint': c.expansionTileExpandedHint,
  'expansionTileCollapsedHint': c.expansionTileCollapsedHint,
  'expansionTileExpandedTapHint': c.expansionTileExpandedTapHint,
  'expansionTileCollapsedTapHint': c.expansionTileCollapsedTapHint,
  'expandedHint': c.expandedHint,
  'collapsedHint': c.collapsedHint,
  for (final d in _dates) 'datePickerMediumDate($d)': c.datePickerMediumDate(d),
  'datePickerYear': c.datePickerYear(2026),
  for (var i = 1; i <= 12; i++) ...{
    'datePickerMonth($i)': c.datePickerMonth(i),
    'datePickerStandaloneMonth($i)': c.datePickerStandaloneMonth(i),
  },
  'datePickerDayOfMonth': c.datePickerDayOfMonth(5),
  for (var w = 1; w <= 7; w++)
    'datePickerDayOfMonth(5, $w)': c.datePickerDayOfMonth(5, w),
  for (final n in [0, 1, 2, 5, 13, 59]) ...{
    'datePickerHour($n)': c.datePickerHour(n),
    'datePickerHourSemanticsLabel($n)': c.datePickerHourSemanticsLabel(n),
    'datePickerMinute($n)': c.datePickerMinute(n),
    'datePickerMinuteSemanticsLabel($n)': c.datePickerMinuteSemanticsLabel(n),
    'timerPickerHour($n)': c.timerPickerHour(n),
    'timerPickerMinute($n)': c.timerPickerMinute(n),
    'timerPickerSecond($n)': c.timerPickerSecond(n),
    'timerPickerHourLabel($n)': c.timerPickerHourLabel(n),
    'timerPickerMinuteLabel($n)': c.timerPickerMinuteLabel(n),
    'timerPickerSecondLabel($n)': c.timerPickerSecondLabel(n),
  },
};

/// Everything [WidgetsLocalizations] answers.
Map<String, Object?> _widgets(WidgetsLocalizations w) => {
  'textDirection': w.textDirection,
  'reorderItemToStart': w.reorderItemToStart,
  'reorderItemToEnd': w.reorderItemToEnd,
  'reorderItemUp': w.reorderItemUp,
  'reorderItemDown': w.reorderItemDown,
  'reorderItemLeft': w.reorderItemLeft,
  'reorderItemRight': w.reorderItemRight,
  'searchResultsFound': w.searchResultsFound,
  'noResultsFound': w.noResultsFound,
  'copyButtonLabel': w.copyButtonLabel,
  'cutButtonLabel': w.cutButtonLabel,
  'pasteButtonLabel': w.pasteButtonLabel,
  'selectAllButtonLabel': w.selectAllButtonLabel,
  'lookUpButtonLabel': w.lookUpButtonLabel,
  'searchWebButtonLabel': w.searchWebButtonLabel,
  'shareButtonLabel': w.shareButtonLabel,
  'radioButtonUnselectedLabel': w.radioButtonUnselectedLabel,
};

Future<Map<String, Object?>> _answers(
  Iterable<LocalizationsDelegate<Object?>> delegates,
  Locale locale,
) async {
  Future<T> load<T>() =>
      delegates.whereType<LocalizationsDelegate<T>>().single.load(locale);
  return {
    'material': _material(await load<MaterialLocalizations>()),
    'cupertino': _cupertino(await load<CupertinoLocalizations>()),
    'widgets': _widgets(await load<WidgetsLocalizations>()),
    'material type': (await load<MaterialLocalizations>()).runtimeType,
    'cupertino type': (await load<CupertinoLocalizations>()).runtimeType,
    'widgets type': (await load<WidgetsLocalizations>()).runtimeType,
    for (final d in _dates) ...{
      'yMMMMEEEEd($d)': DateFormat.yMMMMEEEEd(locale.languageCode).format(d),
      'yMd($d)': DateFormat.yMd(locale.languageCode).format(d),
      'Hm($d)': DateFormat.Hm(locale.languageCode).format(d),
    },
  };
}

void main() {
  const locales = [Locale('de'), Locale('en')];

  test('the app delegates speak de and en only', () {
    for (final delegate in appLocalizationsDelegates) {
      for (final locale in locales) {
        expect(
          delegate.isSupported(locale),
          isTrue,
          reason: '$delegate $locale',
        );
      }
      expect(
        delegate.isSupported(const Locale('fr')),
        isFalse,
        reason: '$delegate',
      );
    }
  });

  // One test: intl's date data is global, and the SDK's delegates load every
  // locale's, so the app's answers are taken before the SDK's are loaded.
  test('they answer what the SDK delegates answer', () async {
    final ours = {
      for (final locale in locales)
        locale: await _answers(appLocalizationsDelegates, locale),
    };
    expect(
      ours[const Locale('de')]!['yMMMMEEEEd(${_dates.first})'],
      'Donnerstag, 5. November 2026',
    );
    expect(
      ours[const Locale('en')]!['yMMMMEEEEd(${_dates.first})'],
      'Thursday, November 5, 2026',
    );
    for (final locale in locales) {
      expect(
        ours[locale],
        await _answers(AppLocalizations.localizationsDelegates, locale),
        reason: '$locale',
      );
    }
  });
}
