// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Hummlist';

  @override
  String get addFieldHint => 'Was fehlt?';

  @override
  String get addButton => 'Hinzufügen';

  @override
  String get emptyList => 'The list is empty. Type above what you need.';

  @override
  String get sortingItem => 'Sorting …';

  @override
  String get recentlyBought => 'Recently bought';

  @override
  String get readd => 'Back on the list';

  @override
  String itemTicked(String name) {
    return '$name ticked off';
  }

  @override
  String itemDeleted(String name) {
    return '$name deleted';
  }

  @override
  String itemReadded(String name) {
    return '$name is back on the list';
  }

  @override
  String alreadyOnList(String name) {
    return '$name steht schon auf der Liste';
  }

  @override
  String get dictationStart => 'Diktieren';

  @override
  String get dictationStop => 'Diktat beenden';

  @override
  String get dictationListening => 'Ich höre zu …';

  @override
  String get dictationUnavailable =>
      'Spracheingabe ist nicht verfügbar. Erlaube Mikrofon und Spracherkennung in den Einstellungen.';

  @override
  String get dictationNoOfflineGerman =>
      'Diktieren geht nur offline, damit deine Stimme auf dem Gerät bleibt. Dafür fehlt hier die deutsche Offline-Spracherkennung. Lade sie in den Systemeinstellungen herunter oder tippe den Eintrag ein.';

  @override
  String get dictationNothingHeard => 'Ich habe nichts gehört.';

  @override
  String get dictationNothingUnderstood =>
      'Ich habe nichts verstanden, was auf die Liste soll.';

  @override
  String get dictationSplitFailed =>
      'Keine Verbindung. Der Text steht im Feld; prüfe ihn und tippe auf Hinzufügen.';

  @override
  String dictationAdded(String items) {
    return 'Hinzugefügt: $items.';
  }

  @override
  String dictationAlreadyOnList(String items) {
    return 'Schon auf der Liste: $items.';
  }

  @override
  String get undo => 'Undo';

  @override
  String editTitle(String name) {
    return 'Edit: $name';
  }

  @override
  String get editSheet => 'Edit';

  @override
  String get fieldName => 'Name';

  @override
  String get fieldBrand => 'Brand';

  @override
  String get brandNone => 'no brand';

  @override
  String get itemQuantity => 'Qty';

  @override
  String get fieldProperties => 'Details';

  @override
  String get propertiesExample => 'e.g. organic, 1 l';

  @override
  String get quantityMinus => 'One less';

  @override
  String get quantityPlus => 'One more';

  @override
  String get noStore => 'No store';

  @override
  String chipStore(String name) {
    return 'Store: $name';
  }

  @override
  String chipCategory(String name) {
    return 'Category: $name';
  }

  @override
  String get categoryAuto => 'Category: automatic';

  @override
  String get editHint => 'Only what you change is saved';

  @override
  String get save => 'Speichern';

  @override
  String get cancel => 'Cancel';

  @override
  String get delete => 'Delete';

  @override
  String get offline =>
      'Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist';

  @override
  String pendingChanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Änderungen werden synchronisiert',
      one: '1 Änderung wird synchronisiert',
    );
    return '$_temp0';
  }

  @override
  String syncFailed(String name) {
    return 'Change refused: $name';
  }

  @override
  String get menu => 'Menü';

  @override
  String get inviteMember => 'Mitglied einladen';

  @override
  String get joinOtherHousehold => 'Anderem Haushalt beitreten';

  @override
  String get signOut => 'Abmelden';

  @override
  String get inviteTitle => 'Mitglied einladen';

  @override
  String get inviteBody =>
      'Gib diesen Code in der App ein oder teile den Link. Er ist 14 Tage gültig.';

  @override
  String get inviteCodeLabel => 'Code';

  @override
  String get inviteLinkLabel => 'Link';

  @override
  String get copy => 'Kopieren';

  @override
  String get copied => 'Kopiert';

  @override
  String get close => 'Schließen';

  @override
  String get signInTitle => 'Anmelden';

  @override
  String get email => 'E-Mail';

  @override
  String get password => 'Passwort';

  @override
  String get signIn => 'Anmelden';

  @override
  String get signUp => 'Registrieren';

  @override
  String get sendMagicLink => 'Anmeldelink per E-Mail senden';

  @override
  String get magicLinkSent =>
      'Wir haben dir einen Anmeldelink geschickt. Öffne ihn auf diesem Gerät.';

  @override
  String get signUpCheckEmail =>
      'Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.';

  @override
  String get invalidEmail => 'Bitte eine gültige E-Mail-Adresse eingeben';

  @override
  String get passwordTooShort => 'Mindestens 6 Zeichen';

  @override
  String authFailed(String message) {
    return 'Anmeldung fehlgeschlagen: $message';
  }

  @override
  String get signInWithGoogle => 'Mit Google anmelden';

  @override
  String get signInWithApple => 'Mit Apple anmelden';

  @override
  String get signInCanceled => 'Anmeldung abgebrochen';

  @override
  String get orWithEmail => 'oder mit E-Mail';

  @override
  String get onboardingTitle => 'Willkommen';

  @override
  String get onboardingBody =>
      'Lege einen Haushalt an oder tritt mit einem Einladungscode bei.';

  @override
  String get householdName => 'Name des Haushalts';

  @override
  String get householdNameDefault => 'Unser Haushalt';

  @override
  String get createHousehold => 'Haushalt anlegen';

  @override
  String get inviteCode => 'Einladungscode';

  @override
  String get joinHousehold => 'Beitreten';

  @override
  String get invalidInvite => 'Dieser Code ist ungültig oder abgelaufen.';

  @override
  String get switchHouseholdWarning =>
      'Du verlässt deinen aktuellen Haushalt. Bist du der letzte, wird er mit seiner Liste gelöscht.';

  @override
  String genericError(String message) {
    return 'Etwas ist schiefgelaufen: $message';
  }

  @override
  String get loading => 'Lädt …';

  @override
  String get consentTitle => 'Zugriff erlauben?';

  @override
  String consentSignedInAs(String email) {
    return 'Angemeldet als $email';
  }

  @override
  String consentHousehold(String name) {
    return 'Haushalt: $name';
  }

  @override
  String consentWants(String client) {
    return '$client möchte:';
  }

  @override
  String get consentListAccess =>
      'Einträge deiner Einkaufsliste lesen, hinzufügen, abhaken und verschieben';

  @override
  String get scopeOpenid => 'Deine Anmeldung bestätigen';

  @override
  String get scopeEmail => 'Deine E-Mail-Adresse';

  @override
  String get scopeProfile => 'Dein Name und Profil';

  @override
  String get scopePhone => 'Deine Telefonnummer';

  @override
  String get scopeOfflineAccess => 'Dauerhaft angemeldet bleiben';

  @override
  String get consentAllow => 'Erlauben';

  @override
  String get consentDeny => 'Ablehnen';

  @override
  String get redirecting => 'Weiterleitung …';

  @override
  String get consentInvalid =>
      'Diese Anfrage ist ungültig oder abgelaufen. Starte die Verbindung in deiner App neu.';

  @override
  String get accessTitle => 'Zugänge';

  @override
  String get mcpServer => 'MCP-Server';

  @override
  String get mcpServerBody =>
      'Für Claude, ChatGPT und andere KI-Assistenten. Verbinde per Anmeldung (OAuth) oder mit einem Zugriffstoken.';

  @override
  String get accessTokens => 'Zugriffstoken';

  @override
  String get noTokens => 'Kein aktiver Token.';

  @override
  String tokenHint(String hint) {
    return '…$hint';
  }

  @override
  String createdOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Erstellt am $dateString';
  }

  @override
  String lastUsedOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Zuletzt benutzt $dateString';
  }

  @override
  String get neverUsed => 'Noch nie benutzt';

  @override
  String get createToken => 'Token erstellen';

  @override
  String get create => 'Erstellen';

  @override
  String get tokenName => 'Name';

  @override
  String get tokenNameHint => 'z. B. Claude oder Siri';

  @override
  String get tokenCreated => 'Token erstellt';

  @override
  String get tokenShownOnce =>
      'Kopiere den Token jetzt. Er wird nicht noch einmal angezeigt.';

  @override
  String get done => 'Done';

  @override
  String revokeToken(String name) {
    return '$name widerrufen';
  }

  @override
  String get revokeTokenTitle => 'Token widerrufen?';

  @override
  String get revokeTokenBody =>
      'Apps, die ihn benutzen, verlieren sofort den Zugriff.';

  @override
  String get revoke => 'Widerrufen';

  @override
  String get tooManyTokens => 'Höchstens 20 aktive Tokens.';

  @override
  String get connectedApps => 'Verbundene Apps';

  @override
  String get noConnectedApps => 'Noch keine App verbunden.';

  @override
  String connectedOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Verbunden am $dateString';
  }

  @override
  String get disconnect => 'Trennen';

  @override
  String disconnectApp(String name) {
    return '$name trennen';
  }

  @override
  String disconnectTitle(String name) {
    return '$name trennen?';
  }

  @override
  String get disconnectBody =>
      'Die App verliert sofort den Zugriff auf deine Liste.';

  @override
  String get editStoreLayout => 'Edit order';

  @override
  String get manageCategories => 'Manage categories';

  @override
  String get categoriesTitle => 'Kategorien';

  @override
  String get categoriesHint =>
      'Items without a store, and stores without their own order, follow this order. Tap a category to rename it.';

  @override
  String get categoryName => 'Name';

  @override
  String get renameCategory => 'Kategorie umbenennen';

  @override
  String get addCategory => 'Kategorie hinzufügen';

  @override
  String deleteCategory(String name) {
    return '$name löschen';
  }

  @override
  String get moveItemsTo => 'Artikel verschieben nach';

  @override
  String dragCategory(String name) {
    return 'Move $name';
  }

  @override
  String categoryNameTaken(String name) {
    return 'Eine Kategorie „$name“ gibt es schon.';
  }

  @override
  String get catalogSaveFailed => 'The change could not be saved.';

  @override
  String storeLayoutTitle(String store) {
    return '$store: order';
  }

  @override
  String get storeLayoutHint =>
      'Order the categories the way you walk through the store.';

  @override
  String newItemsFrom(int count, String name) {
    return '$count neu von $name';
  }

  @override
  String newItems(int count) {
    return '$count neu';
  }

  @override
  String get newItem => 'New';

  @override
  String storeSectionLabel(String store, int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$store, $_temp0';
  }

  @override
  String itemsWord(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'items',
      one: 'item',
    );
    return '$_temp0';
  }

  @override
  String get expandSection => 'Expand';

  @override
  String get collapseSection => 'Collapse';

  @override
  String get moveStoreUp => 'Move store up';

  @override
  String get moveStoreDown => 'Move store down';

  @override
  String get moveCategoryUp => 'Move category up';

  @override
  String get moveCategoryDown => 'Move category down';

  @override
  String get listHint => 'Tap ticks off · Hold edits · Hold and drag moves';

  @override
  String get listHintDismiss => 'Got it';

  @override
  String get reorderNeedsConnection => 'Reordering needs a connection.';

  @override
  String suggestion(String label) {
    return 'Vorschlag: $label';
  }

  @override
  String get dueSuggestions => 'Brauchen wir wieder?';

  @override
  String get account => 'Konto';

  @override
  String get accountExport => 'Meine Daten exportieren';

  @override
  String get accountExportBody =>
      'Alles, was über dich gespeichert ist, als JSON-Datei.';

  @override
  String get accountDelete => 'Konto löschen';

  @override
  String get accountDeleteTitle => 'Konto löschen?';

  @override
  String get accountDeleteWhat =>
      'Dein Konto, dein Profil, deine Zugangs-Tokens und deine verbundenen Apps werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.';

  @override
  String accountDeleteKept(String household, String names) {
    return 'Der Haushalt „$household“ bleibt für $names mit der ganzen Liste erhalten. Deine Einträge bleiben dort, aber ohne deinen Namen.';
  }

  @override
  String accountDeleteKeptUnnamed(String household) {
    return 'Der Haushalt „$household“ bleibt für die anderen Mitglieder mit der ganzen Liste erhalten. Deine Einträge bleiben dort, aber ohne deinen Namen.';
  }

  @override
  String namesAnd(String first, String last) {
    return '$first und $last';
  }

  @override
  String accountDeleteDeleted(String household) {
    return 'Du bist das letzte Mitglied. Deshalb wird der Haushalt „$household“ mit Liste, Verlauf, Kategorien und Geschäften gelöscht.';
  }

  @override
  String get accountDeleteNone =>
      'Du bist in keinem Haushalt, geteilte Daten gibt es nicht.';

  @override
  String get accountDeleteExportHint =>
      'Mit „Meine Daten exportieren“ in den Einstellungen kannst du vorher eine Kopie sichern.';

  @override
  String get accountDeleteConfirmLabel => 'Zum Bestätigen LÖSCHEN eingeben';

  @override
  String get accountDeleteConfirm => 'Endgültig löschen';

  @override
  String get accountDeleteOffline =>
      'Keine Internetverbindung. Dein Konto wurde nicht gelöscht. Versuche es erneut, sobald du online bist.';

  @override
  String accountDeleteFailed(String code) {
    return 'Löschen fehlgeschlagen ($code). Dein Konto wurde nicht gelöscht.';
  }

  @override
  String get accountDeleteCanceled =>
      'Abgebrochen. Dein Konto wurde nicht gelöscht.';

  @override
  String get accountFateOffline =>
      'Keine Internetverbindung. Was mit deinem Haushalt passiert, konnte nicht geladen werden.';

  @override
  String accountFateFailed(String code) {
    return 'Was mit deinem Haushalt passiert, konnte nicht geladen werden ($code).';
  }

  @override
  String get accountDeletedNotice => 'Dein Konto wurde gelöscht.';

  @override
  String get accountDeletedApple =>
      'Falls du dich mit Apple angemeldet hattest: Entferne „Hummlist“ auf deinem iPhone unter Einstellungen › [dein Name] › Anmelden & Sicherheit › Mit Apple anmelden.';

  @override
  String get exportDone => 'Daten exportiert';

  @override
  String exportDoneAt(String path) {
    return 'Daten exportiert: $path';
  }

  @override
  String get exportOffline =>
      'Keine Internetverbindung. Deine Daten wurden nicht exportiert.';

  @override
  String exportFailed(String code) {
    return 'Export fehlgeschlagen ($code).';
  }
}
