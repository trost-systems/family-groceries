// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get appTitle => 'Hummlist';

  @override
  String get addFieldHint => 'Was brauchst du?';

  @override
  String get addButton => 'Hinzufügen';

  @override
  String get emptyList => 'Die Liste ist leer. Tippe unten ein, was fehlt.';

  @override
  String get sortingItem => 'Wird einsortiert …';

  @override
  String get recentlyUsed => 'Zuletzt verwendet';

  @override
  String get readd => 'Wieder auf die Liste';

  @override
  String itemDeleted(String name) {
    return '$name gelöscht';
  }

  @override
  String itemReadded(String name) {
    return '$name steht wieder auf der Liste';
  }

  @override
  String alreadyOnList(String name) {
    return '$name steht schon auf der Liste';
  }

  @override
  String get dedupeMerge => 'Zusammenführen';

  @override
  String dedupeMerged(String item) {
    return 'Zusammengeführt: $item';
  }

  @override
  String mergeRefused(String name) {
    return '$name konnte nicht zusammengeführt werden';
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
  String get undo => 'Rückgängig';

  @override
  String editTitle(String name) {
    return 'Bearbeiten: $name';
  }

  @override
  String get editSheet => 'Bearbeiten';

  @override
  String get fieldName => 'Bezeichnung';

  @override
  String get fieldBrand => 'Marke';

  @override
  String get brandNone => 'ohne Marke';

  @override
  String get itemQuantity => 'Menge';

  @override
  String get fieldProperties => 'Eigenschaften';

  @override
  String get propertiesExample => 'z. B. Bio, 1 l';

  @override
  String get quantityMinus => 'Eins weniger';

  @override
  String get quantityPlus => 'Eins mehr';

  @override
  String get noStore => 'Ohne Laden';

  @override
  String chipStore(String name) {
    return 'Laden: $name';
  }

  @override
  String chipCategory(String name) {
    return 'Kategorie: $name';
  }

  @override
  String get categoryAuto => 'Kategorie: automatisch';

  @override
  String get editHint => 'Gespeichert wird nur, was du änderst';

  @override
  String get save => 'Speichern';

  @override
  String get cancel => 'Abbrechen';

  @override
  String get delete => 'Löschen';

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
    return 'Änderung abgelehnt: $name';
  }

  @override
  String get inviteMember => 'Partner einladen';

  @override
  String get joinOtherHousehold => 'Anderem Haushalt beitreten';

  @override
  String get signOut => 'Abmelden';

  @override
  String get inviteTitle => 'Mitglied einladen';

  @override
  String get inviteBody =>
      'Gib diesen Code in der App ein oder teile den Link. Die Einladung gilt 7 Tage und für eine Person.';

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
  String get onboardingTitle => 'Willkommen bei Hummlist';

  @override
  String get onboardingBody =>
      'Hummlist teilt eine Einkaufsliste mit allen in deinem Haushalt. Erstelle einen neuen Haushalt oder nimm eine Einladung an.';

  @override
  String get householdName => 'Name des Haushalts';

  @override
  String get householdNameDefault => 'Unser Haushalt';

  @override
  String get createHousehold => 'Haushalt erstellen';

  @override
  String get inviteCode => 'Einladungscode';

  @override
  String get joinHousehold => 'Haushalt beitreten';

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
  String consentListAccess(String client) {
    return 'Einträge deiner Einkaufsliste lesen, hinzufügen, abhaken und verschieben. $client und sein Anbieter erhalten dabei die Inhalte eurer Liste.';
  }

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
  String get done => 'Fertig';

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
  String get editStoreLayout => 'Reihenfolge bearbeiten';

  @override
  String get manageCategories => 'Kategorien verwalten';

  @override
  String get categoriesTitle => 'Kategorien';

  @override
  String get categoriesHint =>
      'In dieser Reihenfolge stehen die Kategorien unter „Ohne Laden“ und bei Läden ohne eigene Reihenfolge. Tippe auf eine Kategorie, um sie umzubenennen.';

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
    return '$name verschieben';
  }

  @override
  String categoryNameTaken(String name) {
    return 'Eine Kategorie „$name“ gibt es schon.';
  }

  @override
  String get catalogSaveFailed =>
      'Die Änderung konnte nicht gespeichert werden.';

  @override
  String storeLayoutTitle(String store) {
    return '$store: Reihenfolge';
  }

  @override
  String get storeLayoutHint =>
      'Ordne die Kategorien so, wie du durch den Laden gehst.';

  @override
  String newItemsFrom(int count, String name) {
    return '$count neu von $name';
  }

  @override
  String newItems(int count) {
    return '$count neu';
  }

  @override
  String get newItem => 'Neu';

  @override
  String storeSectionLabel(String store, int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Artikel',
      one: '1 Artikel',
    );
    return '$store, $_temp0';
  }

  @override
  String itemsWord(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Artikel',
      one: 'Artikel',
    );
    return '$_temp0';
  }

  @override
  String get expandSection => 'Aufklappen';

  @override
  String get collapseSection => 'Zuklappen';

  @override
  String get moveStoreUp => 'Laden nach oben';

  @override
  String get moveStoreDown => 'Laden nach unten';

  @override
  String get moveCategoryUp => 'Kategorie nach oben';

  @override
  String get moveCategoryDown => 'Kategorie nach unten';

  @override
  String get listHint =>
      'Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt';

  @override
  String get listHintDismiss => 'Verstanden';

  @override
  String get reorderNeedsConnection =>
      'Die Reihenfolge lässt sich nur mit Verbindung ändern.';

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
      'Mit „Meine Daten exportieren“ unter Konto kannst du vorher eine Kopie sichern.';

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

  @override
  String get tabList => 'Liste';

  @override
  String get tabMore => 'Mehr';

  @override
  String get addSheetHint =>
      'Antippen fügt hinzu · ↵ nimmt den ersten Vorschlag';

  @override
  String get storeAuto => 'Laden: automatisch';

  @override
  String get typeToSuggest => 'Tippe, um Vorschläge zu sehen';

  @override
  String get suggestionTyped => 'Wie getippt';

  @override
  String get suggestionHistory => 'Schon mal gekauft';

  @override
  String get suggestionPack => 'Andere Packung';

  @override
  String get suggestionVariant => 'Andere Sorte';

  @override
  String get suggestionSize => 'Andere Größe';

  @override
  String get suggestionBrand => 'Andere Marke';

  @override
  String get suggestionCatalog => 'Aus dem Katalog';

  @override
  String get suggestionDue => 'Wieder fällig';

  @override
  String addedTo(String name, String store) {
    return 'Hinzugefügt: $name → $store';
  }

  @override
  String addedItem(String name) {
    return 'Hinzugefügt: $name';
  }

  @override
  String get clearInput => 'Eingabe leeren';

  @override
  String listItemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Artikel',
      one: '1 Artikel',
    );
    return '$_temp0';
  }

  @override
  String get household => 'Haushalt';

  @override
  String get storesTitle => 'Läden';

  @override
  String get storesRowHint => 'Reihenfolge und Laufweg';

  @override
  String get storesHint =>
      'Halten und ziehen ändert die Reihenfolge der Läden in der Liste. Ein Laden öffnet seinen Laufweg.';

  @override
  String dragStore(String store) {
    return '$store verschieben';
  }

  @override
  String get accessRowHint => 'MCP-Server, Zugangsschlüssel, verbundene Apps';

  @override
  String get accountRowHint => 'Daten exportieren, Konto löschen';

  @override
  String get settingsTitle => 'Einstellungen';

  @override
  String get settingsRowHint => 'Darstellung und Sprache';

  @override
  String get appearance => 'Darstellung';

  @override
  String get themeSystem => 'Wie Gerät';

  @override
  String get themeLight => 'Hell';

  @override
  String get themeDark => 'Dunkel';

  @override
  String get language => 'Sprache';

  @override
  String get languageSystem => 'Wie Gerät';

  @override
  String languageSystemNow(String language) {
    return 'Gerade $language';
  }

  @override
  String languageSystemPicked(String language) {
    return 'Wie Gerät ($language)';
  }

  @override
  String get legal => 'Rechtliches';

  @override
  String get imprint => 'Impressum';

  @override
  String get privacy => 'Datenschutz';

  @override
  String get licenses => 'Lizenzen';

  @override
  String appVersion(String version) {
    return 'Version $version';
  }

  @override
  String get categoryProduce => 'Obst & Gemüse';

  @override
  String get categoryBakery => 'Brot & Backwaren';

  @override
  String get categoryChilled => 'Kühlregal';

  @override
  String get categoryMeat => 'Fleisch/Wurst/Fisch';

  @override
  String get categoryPantry => 'Vorrat & Konserven';

  @override
  String get categorySweets => 'Süßes & Snacks';

  @override
  String get categoryDrinks => 'Getränke';

  @override
  String get categoryFrozen => 'Tiefkühl';

  @override
  String get categoryHousehold => 'Haushalt';

  @override
  String get categoryDrugstore => '👶 Drogerie';

  @override
  String get categoryOther => 'Sonstiges';

  @override
  String get analyticsConsentTitle => 'Darf Hummlist Nutzungsdaten erfassen?';

  @override
  String get analyticsConsentBody =>
      'Peter Trost, der Anbieter von Hummlist, möchte verstehen, welche Funktionen genutzt werden, Fehler finden und messen, ob sich Hummlist wirtschaftlich trägt. Dafür speichert Hummlist mit deiner Erlaubnis eine zufällige Kennung auf diesem Gerät und sendet Nutzungsdaten und Fehlerberichte an unseren Dienstleister PostHog (Server in der EU): zum Beispiel, dass ein Artikel hinzugefügt oder abgehakt wurde, mit dieser Kennung, der Kennung deines Haushalts, Plattform und App-Version. Die Daten sind pseudonym, nicht anonym. Artikelnamen, Listeninhalte, Namen, E-Mail-Adressen, IP-Adresse und Standort werden nie gesendet. Ohne Erlaubnis wird nichts gespeichert oder gesendet. Du kannst die Erlaubnis jederzeit unter Mehr → Nutzungsdaten widerrufen. Mehr in der';

  @override
  String get analyticsConsentPrivacyLink => 'Datenschutzerklärung';

  @override
  String get analyticsAccept => 'Einverstanden';

  @override
  String get analyticsDecline => 'Ablehnen';

  @override
  String get analyticsSection => 'Nutzungsdaten';

  @override
  String get analyticsToggle => 'Nutzungsdaten und Fehlerberichte senden';

  @override
  String get analyticsToggleHint =>
      'Pseudonym an PostHog (Server in der EU), ohne Listeninhalte. Gilt für dieses Gerät. Ausschalten löscht die Kennung auf diesem Gerät.';

  @override
  String get internalInstall => 'Interne Installation';

  @override
  String get internalInstallOn => 'Diese Installation zählt jetzt als intern.';

  @override
  String get internalInstallOff =>
      'Diese Installation zählt nicht mehr als intern.';

  @override
  String get sendTestError => 'Testfehler senden';

  @override
  String get feedbackSection => 'Feedback';

  @override
  String get feedbackRow => 'Feedback senden';

  @override
  String get feedbackRowHint => 'Fehler, Ideen und Fragen an Peter';

  @override
  String get helpRow => 'Hilfe & Kontakt';

  @override
  String get helpRowHint => 'Fragen, Anleitungen und unsere E-Mail-Adresse';

  @override
  String get feedbackMessage => 'Deine Nachricht';

  @override
  String get feedbackMessageHint => 'Was ist dir aufgefallen?';

  @override
  String get feedbackCategoryBug => 'Bug';

  @override
  String get feedbackCategoryIdea => 'Idee';

  @override
  String get feedbackCategoryOther => 'Sonstiges';

  @override
  String get feedbackCategories => 'Art (optional)';

  @override
  String get feedbackContact => 'Peter darf mich dazu kontaktieren';

  @override
  String get feedbackAttached =>
      'App-Version, Gerät, Sprache und aktueller Bildschirm. Keine Listeneinträge.';

  @override
  String get feedbackAttachedTitle => 'Wird mitgeschickt:';

  @override
  String get feedbackSend => 'Senden';

  @override
  String get feedbackRetry => 'Erneut senden';

  @override
  String get feedbackSending => 'Wird gesendet …';

  @override
  String get feedbackThanks => 'Danke!';

  @override
  String get feedbackFailed =>
      'Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.';

  @override
  String feedbackTooLong(int max) {
    return 'Höchstens $max Zeichen';
  }

  @override
  String feedbackCounter(int count, int max) {
    return '$count / $max';
  }

  @override
  String get feedbackClose => 'Schließen';

  @override
  String get onboardingCreateHint =>
      'Eine neue Liste, zu der du danach deinen Partner einlädst.';

  @override
  String get onboardingJoin => 'Einladung annehmen';

  @override
  String get onboardingJoinHint =>
      'Du hast einen Link oder einen Code bekommen.';

  @override
  String get householdNameInvalid =>
      'Gib einen Namen mit 1 bis 80 Zeichen ein.';

  @override
  String get storesChoice => 'Läden';

  @override
  String get defaultStores => 'Deutsche Standard-Läden hinzufügen';

  @override
  String get defaultStoresHint =>
      'dm, Lidl und Edeka, jeweils in ihrer Gangfolge';

  @override
  String get skipStores => 'Überspringen';

  @override
  String get skipStoresHint =>
      'Ohne Läden starten. Du kannst sie später unter Mehr anlegen.';

  @override
  String get householdOffline =>
      'Keine Internetverbindung. Versuche es erneut, sobald du online bist.';

  @override
  String get tooManyAttempts => 'Zu viele Versuche. Bitte später noch einmal.';

  @override
  String get alreadyInHousehold => 'Du bist schon in einem Haushalt';

  @override
  String switchHouseholdAlone(String household) {
    return 'Du bist das einzige Mitglied von „$household“. Trittst du bei, wird „$household“ mit seiner Liste gelöscht.';
  }

  @override
  String switchHouseholdShared(String household) {
    return 'Trittst du bei, verlässt du „$household“. Die anderen Mitglieder behalten die Liste.';
  }

  @override
  String get inviteCheck => 'Weiter';

  @override
  String get invitePreview => 'Einladung in den Haushalt';

  @override
  String get invitePartnerBody =>
      'Teile den Link oder den Code mit der Person, mit der du einkaufst. Die Einladung gilt 7 Tage und für eine Person.';

  @override
  String get later => 'Später';

  @override
  String get toTheList => 'Weiter zur Liste';

  @override
  String inviteShareText(String link, String code) {
    return 'Komm in unseren Hummlist-Haushalt: $link · Code: $code';
  }

  @override
  String inviteShareTextCodeOnly(String code) {
    return 'Komm in unseren Hummlist-Haushalt. Code: $code';
  }

  @override
  String get share => 'Teilen';

  @override
  String get copyLink => 'Link kopieren';

  @override
  String get copyCode => 'Code kopieren';

  @override
  String get linkCopied => 'Link kopiert';

  @override
  String get codeCopied => 'Code kopiert';

  @override
  String get invitesTitle => 'Einladungen';

  @override
  String get invitesOpen => 'Offene Einladungen';

  @override
  String get invitesEmpty => 'Keine offenen Einladungen.';

  @override
  String get newInvite => 'Neue Einladung';

  @override
  String inviteValidUntil(DateTime date, DateTime time) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMMMMd(localeName);
    final String dateString = dateDateFormat.format(date);
    final intl.DateFormat timeDateFormat = intl.DateFormat.Hm(localeName);
    final String timeString = timeDateFormat.format(time);

    return 'gültig bis $dateString, $timeString Uhr';
  }

  @override
  String get inviteRevoke => 'Widerrufen';

  @override
  String inviteRevokeLabel(String code) {
    return 'Einladung $code widerrufen';
  }

  @override
  String get inviteRevoked =>
      'Einladung widerrufen. Link und Code gelten nicht mehr.';

  @override
  String get retry => 'Erneut versuchen';

  @override
  String get lifetimeTitle => 'Hummlist Lifetime';

  @override
  String get lifetimeRowHint => 'Hummlist unterstützen';

  @override
  String get lifetimeBody =>
      'Ein Kauf, für euren ganzen Haushalt: Hummlist Lifetime unterstützt die Entwicklung von Hummlist.';

  @override
  String lifetimeBuy(String price) {
    return 'Für $price kaufen';
  }

  @override
  String get lifetimeRestore => 'Käufe wiederherstellen';

  @override
  String get lifetimeUnlocked => 'Freigeschaltet';

  @override
  String get lifetimeUnlockedBody =>
      'Hummlist Lifetime ist für euren ganzen Haushalt freigeschaltet. Danke!';

  @override
  String get lifetimePending => 'Wartet auf Bestätigung';

  @override
  String get lifetimePendingBody =>
      'Hummlist Lifetime wird freigeschaltet, sobald der Kauf bestätigt ist. Das kann etwas dauern.';

  @override
  String get lifetimeUnlocking => 'Wird freigeschaltet …';

  @override
  String get lifetimeUnlockDelayed =>
      'Dein Kauf ist angekommen, die Freischaltung dauert nur länger als sonst. Sie erscheint hier von selbst; bitte nicht noch einmal kaufen.';

  @override
  String get lifetimeBoughtTwice =>
      'Euer Haushalt hat Hummlist Lifetime mehr als einmal gekauft. Einen der Käufe können Apple oder Google erstatten.';

  @override
  String get lifetimeCanceled => 'Kauf abgebrochen.';

  @override
  String get lifetimeComingSoon => 'Hummlist Lifetime ist bald verfügbar.';

  @override
  String get lifetimeStoreOffline =>
      'Der Store ist gerade nicht erreichbar. Prüfe die Verbindung.';

  @override
  String get lifetimeUsedElsewhere =>
      'Dieser Kauf gehört zu einem anderen, früheren Haushalt und bleibt dort. Hier schaltet er nichts frei.';

  @override
  String get lifetimeNothingRestored => 'Kein früherer Kauf gefunden.';

  @override
  String lifetimeStoreFailed(String code) {
    return 'Der Kauf hat nicht geklappt ($code).';
  }

  @override
  String get lifetimeWeb =>
      'Kaufen kannst du Hummlist Lifetime in der iPhone- oder Android-App. Danach ist es auch hier für deinen ganzen Haushalt freigeschaltet.';

  @override
  String get lifetimeChecking =>
      'Wir prüfen, ob dein Haushalt Hummlist Lifetime schon hat …';

  @override
  String get lifetimeRefundLink =>
      'Doppelt gekauft? So bekommst du dein Geld zurück';

  @override
  String get refundHelpTitle => 'Kauf zurückfordern';

  @override
  String get refundHelpBody =>
      'Hummlist Lifetime gehört immer zu dem Haushalt, in dem es gekauft wurde. Erstatten können wir selbst nichts: Das machen Apple und Google, und sie entscheiden darüber.';

  @override
  String get refundHelpApple =>
      'iPhone: Öffne reportaproblem.apple.com, melde dich mit deinem Apple Account an, wähle „Rückerstattung anfordern“ und dann Hummlist Lifetime.';

  @override
  String get refundHelpGoogle =>
      'Android: Öffne Google Play, tippe auf dein Profilbild, dann „Zahlungen und Abos“, „Budget und Bestellverlauf“, wähle Hummlist Lifetime und „Problem melden“.';

  @override
  String get refundHelpReason =>
      'Als Grund kannst du schreiben: „Mein Haushalt war schon freigeschaltet.“';

  @override
  String get refundHelpAppleLink => 'Bei Apple anfragen';

  @override
  String get refundHelpGoogleLink => 'Bei Google anfragen';

  @override
  String get joinTargetUnlocked =>
      'Dieser Haushalt hat Hummlist Lifetime. Du musst nichts kaufen.';

  @override
  String get joinRefundLink =>
      'Du hast Hummlist Lifetime vor Kurzem gekauft? So forderst du den Kauf zurück';

  @override
  String joinLifetimeEnds(String household) {
    return '„$household“ hat Hummlist Lifetime. Du bist das letzte Mitglied: Trittst du bei, wird der Haushalt gelöscht. Hummlist Lifetime endet mit ihm und wird nicht erstattet, denn ein Kauf gehört zu seinem Haushalt und zieht nicht mit um.';
  }

  @override
  String get joinAnyway => 'Trotzdem beitreten';

  @override
  String get joinLifetimeRefundLink =>
      'Erstattung bei Apple oder Google anfragen';

  @override
  String joinArchiveOffer(String household) {
    return '„$household“ hat Hummlist Lifetime. Du bist das letzte Mitglied. Archiviere den Haushalt, statt ihn zu löschen: Liste und Hummlist Lifetime bleiben erhalten, und du kannst ihn später unter „Mehr“ wieder aktivieren.';
  }

  @override
  String get joinArchive => 'Archivieren und beitreten';

  @override
  String get joinDelete => 'Löschen und beitreten';

  @override
  String joinDeleteTitle(String household) {
    return '„$household“ löschen?';
  }

  @override
  String get archivedTitle => 'Archivierte Haushalte';

  @override
  String get archivedEmpty => 'Du hast keinen Haushalt archiviert.';

  @override
  String get archivedUnlocked => 'Mit Hummlist Lifetime';

  @override
  String get archivedRestore => 'Wieder aktivieren';

  @override
  String archivedRestoreTitle(String household) {
    return '„$household“ wieder aktivieren?';
  }

  @override
  String archivedRestoreBody(String household) {
    return 'Du wechselst in „$household“ und bist dort wieder Mitglied.';
  }

  @override
  String archivedRestoreArchivesCurrent(String household) {
    return 'Du bist das letzte Mitglied von „$household“. Weil er Hummlist Lifetime hat, wird er archiviert, nicht gelöscht.';
  }
}
