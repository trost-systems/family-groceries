import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_de.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('de'),
    Locale('en'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In de, this message translates to:
  /// **'Hummlist'**
  String get appTitle;

  /// No description provided for @addFieldHint.
  ///
  /// In de, this message translates to:
  /// **'Was brauchst du?'**
  String get addFieldHint;

  /// No description provided for @addButton.
  ///
  /// In de, this message translates to:
  /// **'Hinzufügen'**
  String get addButton;

  /// No description provided for @emptyList.
  ///
  /// In de, this message translates to:
  /// **'Die Liste ist leer. Tippe unten ein, was fehlt.'**
  String get emptyList;

  /// No description provided for @sortingItem.
  ///
  /// In de, this message translates to:
  /// **'Wird einsortiert …'**
  String get sortingItem;

  /// No description provided for @recentlyUsed.
  ///
  /// In de, this message translates to:
  /// **'Zuletzt verwendet'**
  String get recentlyUsed;

  /// No description provided for @readd.
  ///
  /// In de, this message translates to:
  /// **'Wieder auf die Liste'**
  String get readd;

  /// No description provided for @itemDeleted.
  ///
  /// In de, this message translates to:
  /// **'{name} gelöscht'**
  String itemDeleted(String name);

  /// No description provided for @itemReadded.
  ///
  /// In de, this message translates to:
  /// **'{name} steht wieder auf der Liste'**
  String itemReadded(String name);

  /// No description provided for @alreadyOnList.
  ///
  /// In de, this message translates to:
  /// **'{name} steht schon auf der Liste'**
  String alreadyOnList(String name);

  /// No description provided for @dictationStart.
  ///
  /// In de, this message translates to:
  /// **'Diktieren'**
  String get dictationStart;

  /// No description provided for @dictationStop.
  ///
  /// In de, this message translates to:
  /// **'Diktat beenden'**
  String get dictationStop;

  /// No description provided for @dictationListening.
  ///
  /// In de, this message translates to:
  /// **'Ich höre zu …'**
  String get dictationListening;

  /// No description provided for @dictationUnavailable.
  ///
  /// In de, this message translates to:
  /// **'Spracheingabe ist nicht verfügbar. Erlaube Mikrofon und Spracherkennung in den Einstellungen.'**
  String get dictationUnavailable;

  /// No description provided for @dictationNoOfflineGerman.
  ///
  /// In de, this message translates to:
  /// **'Diktieren geht nur offline, damit deine Stimme auf dem Gerät bleibt. Dafür fehlt hier die deutsche Offline-Spracherkennung. Lade sie in den Systemeinstellungen herunter oder tippe den Eintrag ein.'**
  String get dictationNoOfflineGerman;

  /// No description provided for @dictationNothingHeard.
  ///
  /// In de, this message translates to:
  /// **'Ich habe nichts gehört.'**
  String get dictationNothingHeard;

  /// No description provided for @dictationNothingUnderstood.
  ///
  /// In de, this message translates to:
  /// **'Ich habe nichts verstanden, was auf die Liste soll.'**
  String get dictationNothingUnderstood;

  /// No description provided for @dictationSplitFailed.
  ///
  /// In de, this message translates to:
  /// **'Keine Verbindung. Der Text steht im Feld; prüfe ihn und tippe auf Hinzufügen.'**
  String get dictationSplitFailed;

  /// No description provided for @dictationAdded.
  ///
  /// In de, this message translates to:
  /// **'Hinzugefügt: {items}.'**
  String dictationAdded(String items);

  /// No description provided for @dictationAlreadyOnList.
  ///
  /// In de, this message translates to:
  /// **'Schon auf der Liste: {items}.'**
  String dictationAlreadyOnList(String items);

  /// No description provided for @undo.
  ///
  /// In de, this message translates to:
  /// **'Rückgängig'**
  String get undo;

  /// No description provided for @editTitle.
  ///
  /// In de, this message translates to:
  /// **'Bearbeiten: {name}'**
  String editTitle(String name);

  /// No description provided for @editSheet.
  ///
  /// In de, this message translates to:
  /// **'Bearbeiten'**
  String get editSheet;

  /// No description provided for @fieldName.
  ///
  /// In de, this message translates to:
  /// **'Bezeichnung'**
  String get fieldName;

  /// No description provided for @fieldBrand.
  ///
  /// In de, this message translates to:
  /// **'Marke'**
  String get fieldBrand;

  /// No description provided for @brandNone.
  ///
  /// In de, this message translates to:
  /// **'ohne Marke'**
  String get brandNone;

  /// No description provided for @itemQuantity.
  ///
  /// In de, this message translates to:
  /// **'Menge'**
  String get itemQuantity;

  /// No description provided for @fieldProperties.
  ///
  /// In de, this message translates to:
  /// **'Eigenschaften'**
  String get fieldProperties;

  /// No description provided for @propertiesExample.
  ///
  /// In de, this message translates to:
  /// **'z. B. Bio, 1 l'**
  String get propertiesExample;

  /// No description provided for @quantityMinus.
  ///
  /// In de, this message translates to:
  /// **'Eins weniger'**
  String get quantityMinus;

  /// No description provided for @quantityPlus.
  ///
  /// In de, this message translates to:
  /// **'Eins mehr'**
  String get quantityPlus;

  /// No description provided for @noStore.
  ///
  /// In de, this message translates to:
  /// **'Ohne Laden'**
  String get noStore;

  /// Screen-reader name of the store chip in the edit and add sheets
  ///
  /// In de, this message translates to:
  /// **'Laden: {name}'**
  String chipStore(String name);

  /// Screen-reader name of the category chip
  ///
  /// In de, this message translates to:
  /// **'Kategorie: {name}'**
  String chipCategory(String name);

  /// No description provided for @categoryAuto.
  ///
  /// In de, this message translates to:
  /// **'Kategorie: automatisch'**
  String get categoryAuto;

  /// No description provided for @editHint.
  ///
  /// In de, this message translates to:
  /// **'Gespeichert wird nur, was du änderst'**
  String get editHint;

  /// No description provided for @save.
  ///
  /// In de, this message translates to:
  /// **'Speichern'**
  String get save;

  /// No description provided for @cancel.
  ///
  /// In de, this message translates to:
  /// **'Abbrechen'**
  String get cancel;

  /// No description provided for @delete.
  ///
  /// In de, this message translates to:
  /// **'Löschen'**
  String get delete;

  /// No description provided for @offline.
  ///
  /// In de, this message translates to:
  /// **'Offline: Änderungen werden synchronisiert, sobald die Verbindung zurück ist'**
  String get offline;

  /// No description provided for @pendingChanges.
  ///
  /// In de, this message translates to:
  /// **'{count, plural, =1{1 Änderung wird synchronisiert} other{{count} Änderungen werden synchronisiert}}'**
  String pendingChanges(int count);

  /// No description provided for @syncFailed.
  ///
  /// In de, this message translates to:
  /// **'Änderung abgelehnt: {name}'**
  String syncFailed(String name);

  /// No description provided for @menu.
  ///
  /// In de, this message translates to:
  /// **'Menü'**
  String get menu;

  /// No description provided for @inviteMember.
  ///
  /// In de, this message translates to:
  /// **'Partner einladen'**
  String get inviteMember;

  /// No description provided for @joinOtherHousehold.
  ///
  /// In de, this message translates to:
  /// **'Anderem Haushalt beitreten'**
  String get joinOtherHousehold;

  /// No description provided for @signOut.
  ///
  /// In de, this message translates to:
  /// **'Abmelden'**
  String get signOut;

  /// No description provided for @inviteTitle.
  ///
  /// In de, this message translates to:
  /// **'Mitglied einladen'**
  String get inviteTitle;

  /// No description provided for @inviteBody.
  ///
  /// In de, this message translates to:
  /// **'Gib diesen Code in der App ein oder teile den Link. Die Einladung gilt 7 Tage und für eine Person.'**
  String get inviteBody;

  /// No description provided for @inviteCodeLabel.
  ///
  /// In de, this message translates to:
  /// **'Code'**
  String get inviteCodeLabel;

  /// No description provided for @inviteLinkLabel.
  ///
  /// In de, this message translates to:
  /// **'Link'**
  String get inviteLinkLabel;

  /// No description provided for @copy.
  ///
  /// In de, this message translates to:
  /// **'Kopieren'**
  String get copy;

  /// No description provided for @copied.
  ///
  /// In de, this message translates to:
  /// **'Kopiert'**
  String get copied;

  /// No description provided for @close.
  ///
  /// In de, this message translates to:
  /// **'Schließen'**
  String get close;

  /// No description provided for @signInTitle.
  ///
  /// In de, this message translates to:
  /// **'Anmelden'**
  String get signInTitle;

  /// No description provided for @email.
  ///
  /// In de, this message translates to:
  /// **'E-Mail'**
  String get email;

  /// No description provided for @password.
  ///
  /// In de, this message translates to:
  /// **'Passwort'**
  String get password;

  /// No description provided for @signIn.
  ///
  /// In de, this message translates to:
  /// **'Anmelden'**
  String get signIn;

  /// No description provided for @signUp.
  ///
  /// In de, this message translates to:
  /// **'Registrieren'**
  String get signUp;

  /// No description provided for @sendMagicLink.
  ///
  /// In de, this message translates to:
  /// **'Anmeldelink per E-Mail senden'**
  String get sendMagicLink;

  /// No description provided for @magicLinkSent.
  ///
  /// In de, this message translates to:
  /// **'Wir haben dir einen Anmeldelink geschickt. Öffne ihn auf diesem Gerät.'**
  String get magicLinkSent;

  /// No description provided for @signUpCheckEmail.
  ///
  /// In de, this message translates to:
  /// **'Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.'**
  String get signUpCheckEmail;

  /// No description provided for @invalidEmail.
  ///
  /// In de, this message translates to:
  /// **'Bitte eine gültige E-Mail-Adresse eingeben'**
  String get invalidEmail;

  /// No description provided for @passwordTooShort.
  ///
  /// In de, this message translates to:
  /// **'Mindestens 6 Zeichen'**
  String get passwordTooShort;

  /// No description provided for @authFailed.
  ///
  /// In de, this message translates to:
  /// **'Anmeldung fehlgeschlagen: {message}'**
  String authFailed(String message);

  /// No description provided for @signInWithGoogle.
  ///
  /// In de, this message translates to:
  /// **'Mit Google anmelden'**
  String get signInWithGoogle;

  /// No description provided for @signInWithApple.
  ///
  /// In de, this message translates to:
  /// **'Mit Apple anmelden'**
  String get signInWithApple;

  /// No description provided for @signInCanceled.
  ///
  /// In de, this message translates to:
  /// **'Anmeldung abgebrochen'**
  String get signInCanceled;

  /// No description provided for @orWithEmail.
  ///
  /// In de, this message translates to:
  /// **'oder mit E-Mail'**
  String get orWithEmail;

  /// No description provided for @onboardingTitle.
  ///
  /// In de, this message translates to:
  /// **'Willkommen bei Hummlist'**
  String get onboardingTitle;

  /// No description provided for @onboardingBody.
  ///
  /// In de, this message translates to:
  /// **'Hummlist teilt eine Einkaufsliste mit allen in deinem Haushalt. Erstelle einen neuen Haushalt oder nimm eine Einladung an.'**
  String get onboardingBody;

  /// No description provided for @householdName.
  ///
  /// In de, this message translates to:
  /// **'Name des Haushalts'**
  String get householdName;

  /// No description provided for @householdNameDefault.
  ///
  /// In de, this message translates to:
  /// **'Unser Haushalt'**
  String get householdNameDefault;

  /// No description provided for @createHousehold.
  ///
  /// In de, this message translates to:
  /// **'Haushalt erstellen'**
  String get createHousehold;

  /// No description provided for @inviteCode.
  ///
  /// In de, this message translates to:
  /// **'Einladungscode'**
  String get inviteCode;

  /// No description provided for @joinHousehold.
  ///
  /// In de, this message translates to:
  /// **'Haushalt beitreten'**
  String get joinHousehold;

  /// No description provided for @invalidInvite.
  ///
  /// In de, this message translates to:
  /// **'Dieser Code ist ungültig oder abgelaufen.'**
  String get invalidInvite;

  /// No description provided for @switchHouseholdWarning.
  ///
  /// In de, this message translates to:
  /// **'Du verlässt deinen aktuellen Haushalt. Bist du der letzte, wird er mit seiner Liste gelöscht.'**
  String get switchHouseholdWarning;

  /// No description provided for @genericError.
  ///
  /// In de, this message translates to:
  /// **'Etwas ist schiefgelaufen: {message}'**
  String genericError(String message);

  /// No description provided for @loading.
  ///
  /// In de, this message translates to:
  /// **'Lädt …'**
  String get loading;

  /// No description provided for @consentTitle.
  ///
  /// In de, this message translates to:
  /// **'Zugriff erlauben?'**
  String get consentTitle;

  /// No description provided for @consentSignedInAs.
  ///
  /// In de, this message translates to:
  /// **'Angemeldet als {email}'**
  String consentSignedInAs(String email);

  /// No description provided for @consentHousehold.
  ///
  /// In de, this message translates to:
  /// **'Haushalt: {name}'**
  String consentHousehold(String name);

  /// No description provided for @consentWants.
  ///
  /// In de, this message translates to:
  /// **'{client} möchte:'**
  String consentWants(String client);

  /// OAuth consent: the list permission and that the client's provider receives the list (legal review H-17)
  ///
  /// In de, this message translates to:
  /// **'Einträge deiner Einkaufsliste lesen, hinzufügen, abhaken und verschieben. {client} und sein Anbieter erhalten dabei die Inhalte eurer Liste.'**
  String consentListAccess(String client);

  /// No description provided for @scopeOpenid.
  ///
  /// In de, this message translates to:
  /// **'Deine Anmeldung bestätigen'**
  String get scopeOpenid;

  /// No description provided for @scopeEmail.
  ///
  /// In de, this message translates to:
  /// **'Deine E-Mail-Adresse'**
  String get scopeEmail;

  /// No description provided for @scopeProfile.
  ///
  /// In de, this message translates to:
  /// **'Dein Name und Profil'**
  String get scopeProfile;

  /// No description provided for @scopePhone.
  ///
  /// In de, this message translates to:
  /// **'Deine Telefonnummer'**
  String get scopePhone;

  /// No description provided for @scopeOfflineAccess.
  ///
  /// In de, this message translates to:
  /// **'Dauerhaft angemeldet bleiben'**
  String get scopeOfflineAccess;

  /// No description provided for @consentAllow.
  ///
  /// In de, this message translates to:
  /// **'Erlauben'**
  String get consentAllow;

  /// No description provided for @consentDeny.
  ///
  /// In de, this message translates to:
  /// **'Ablehnen'**
  String get consentDeny;

  /// No description provided for @redirecting.
  ///
  /// In de, this message translates to:
  /// **'Weiterleitung …'**
  String get redirecting;

  /// No description provided for @consentInvalid.
  ///
  /// In de, this message translates to:
  /// **'Diese Anfrage ist ungültig oder abgelaufen. Starte die Verbindung in deiner App neu.'**
  String get consentInvalid;

  /// No description provided for @accessTitle.
  ///
  /// In de, this message translates to:
  /// **'Zugänge'**
  String get accessTitle;

  /// No description provided for @mcpServer.
  ///
  /// In de, this message translates to:
  /// **'MCP-Server'**
  String get mcpServer;

  /// No description provided for @mcpServerBody.
  ///
  /// In de, this message translates to:
  /// **'Für Claude, ChatGPT und andere KI-Assistenten. Verbinde per Anmeldung (OAuth) oder mit einem Zugriffstoken.'**
  String get mcpServerBody;

  /// No description provided for @accessTokens.
  ///
  /// In de, this message translates to:
  /// **'Zugriffstoken'**
  String get accessTokens;

  /// No description provided for @noTokens.
  ///
  /// In de, this message translates to:
  /// **'Kein aktiver Token.'**
  String get noTokens;

  /// No description provided for @tokenHint.
  ///
  /// In de, this message translates to:
  /// **'…{hint}'**
  String tokenHint(String hint);

  /// No description provided for @createdOn.
  ///
  /// In de, this message translates to:
  /// **'Erstellt am {date}'**
  String createdOn(DateTime date);

  /// No description provided for @lastUsedOn.
  ///
  /// In de, this message translates to:
  /// **'Zuletzt benutzt {date}'**
  String lastUsedOn(DateTime date);

  /// No description provided for @neverUsed.
  ///
  /// In de, this message translates to:
  /// **'Noch nie benutzt'**
  String get neverUsed;

  /// No description provided for @createToken.
  ///
  /// In de, this message translates to:
  /// **'Token erstellen'**
  String get createToken;

  /// No description provided for @create.
  ///
  /// In de, this message translates to:
  /// **'Erstellen'**
  String get create;

  /// No description provided for @tokenName.
  ///
  /// In de, this message translates to:
  /// **'Name'**
  String get tokenName;

  /// No description provided for @tokenNameHint.
  ///
  /// In de, this message translates to:
  /// **'z. B. Claude oder Siri'**
  String get tokenNameHint;

  /// No description provided for @tokenCreated.
  ///
  /// In de, this message translates to:
  /// **'Token erstellt'**
  String get tokenCreated;

  /// No description provided for @tokenShownOnce.
  ///
  /// In de, this message translates to:
  /// **'Kopiere den Token jetzt. Er wird nicht noch einmal angezeigt.'**
  String get tokenShownOnce;

  /// No description provided for @done.
  ///
  /// In de, this message translates to:
  /// **'Fertig'**
  String get done;

  /// No description provided for @revokeToken.
  ///
  /// In de, this message translates to:
  /// **'{name} widerrufen'**
  String revokeToken(String name);

  /// No description provided for @revokeTokenTitle.
  ///
  /// In de, this message translates to:
  /// **'Token widerrufen?'**
  String get revokeTokenTitle;

  /// No description provided for @revokeTokenBody.
  ///
  /// In de, this message translates to:
  /// **'Apps, die ihn benutzen, verlieren sofort den Zugriff.'**
  String get revokeTokenBody;

  /// No description provided for @revoke.
  ///
  /// In de, this message translates to:
  /// **'Widerrufen'**
  String get revoke;

  /// No description provided for @tooManyTokens.
  ///
  /// In de, this message translates to:
  /// **'Höchstens 20 aktive Tokens.'**
  String get tooManyTokens;

  /// No description provided for @connectedApps.
  ///
  /// In de, this message translates to:
  /// **'Verbundene Apps'**
  String get connectedApps;

  /// No description provided for @noConnectedApps.
  ///
  /// In de, this message translates to:
  /// **'Noch keine App verbunden.'**
  String get noConnectedApps;

  /// No description provided for @connectedOn.
  ///
  /// In de, this message translates to:
  /// **'Verbunden am {date}'**
  String connectedOn(DateTime date);

  /// No description provided for @disconnect.
  ///
  /// In de, this message translates to:
  /// **'Trennen'**
  String get disconnect;

  /// No description provided for @disconnectApp.
  ///
  /// In de, this message translates to:
  /// **'{name} trennen'**
  String disconnectApp(String name);

  /// No description provided for @disconnectTitle.
  ///
  /// In de, this message translates to:
  /// **'{name} trennen?'**
  String disconnectTitle(String name);

  /// No description provided for @disconnectBody.
  ///
  /// In de, this message translates to:
  /// **'Die App verliert sofort den Zugriff auf deine Liste.'**
  String get disconnectBody;

  /// No description provided for @editStoreLayout.
  ///
  /// In de, this message translates to:
  /// **'Reihenfolge bearbeiten'**
  String get editStoreLayout;

  /// No description provided for @manageCategories.
  ///
  /// In de, this message translates to:
  /// **'Kategorien verwalten'**
  String get manageCategories;

  /// No description provided for @categoriesTitle.
  ///
  /// In de, this message translates to:
  /// **'Kategorien'**
  String get categoriesTitle;

  /// No description provided for @categoriesHint.
  ///
  /// In de, this message translates to:
  /// **'In dieser Reihenfolge stehen die Kategorien unter „Ohne Laden“ und bei Läden ohne eigene Reihenfolge. Tippe auf eine Kategorie, um sie umzubenennen.'**
  String get categoriesHint;

  /// No description provided for @categoryName.
  ///
  /// In de, this message translates to:
  /// **'Name'**
  String get categoryName;

  /// No description provided for @renameCategory.
  ///
  /// In de, this message translates to:
  /// **'Kategorie umbenennen'**
  String get renameCategory;

  /// No description provided for @addCategory.
  ///
  /// In de, this message translates to:
  /// **'Kategorie hinzufügen'**
  String get addCategory;

  /// No description provided for @deleteCategory.
  ///
  /// In de, this message translates to:
  /// **'{name} löschen'**
  String deleteCategory(String name);

  /// No description provided for @moveItemsTo.
  ///
  /// In de, this message translates to:
  /// **'Artikel verschieben nach'**
  String get moveItemsTo;

  /// No description provided for @dragCategory.
  ///
  /// In de, this message translates to:
  /// **'{name} verschieben'**
  String dragCategory(String name);

  /// No description provided for @categoryNameTaken.
  ///
  /// In de, this message translates to:
  /// **'Eine Kategorie „{name}“ gibt es schon.'**
  String categoryNameTaken(String name);

  /// No description provided for @catalogSaveFailed.
  ///
  /// In de, this message translates to:
  /// **'Die Änderung konnte nicht gespeichert werden.'**
  String get catalogSaveFailed;

  /// No description provided for @storeLayoutTitle.
  ///
  /// In de, this message translates to:
  /// **'{store}: Reihenfolge'**
  String storeLayoutTitle(String store);

  /// No description provided for @storeLayoutHint.
  ///
  /// In de, this message translates to:
  /// **'Ordne die Kategorien so, wie du durch den Laden gehst.'**
  String get storeLayoutHint;

  /// No description provided for @newItemsFrom.
  ///
  /// In de, this message translates to:
  /// **'{count} neu von {name}'**
  String newItemsFrom(int count, String name);

  /// No description provided for @newItems.
  ///
  /// In de, this message translates to:
  /// **'{count} neu'**
  String newItems(int count);

  /// No description provided for @newItem.
  ///
  /// In de, this message translates to:
  /// **'Neu'**
  String get newItem;

  /// No description provided for @storeSectionLabel.
  ///
  /// In de, this message translates to:
  /// **'{store}, {count, plural, =1{1 Artikel} other{{count} Artikel}}'**
  String storeSectionLabel(String store, int count);

  /// No description provided for @itemsWord.
  ///
  /// In de, this message translates to:
  /// **'{count, plural, =1{Artikel} other{Artikel}}'**
  String itemsWord(int count);

  /// No description provided for @expandSection.
  ///
  /// In de, this message translates to:
  /// **'Aufklappen'**
  String get expandSection;

  /// No description provided for @collapseSection.
  ///
  /// In de, this message translates to:
  /// **'Zuklappen'**
  String get collapseSection;

  /// No description provided for @moveStoreUp.
  ///
  /// In de, this message translates to:
  /// **'Laden nach oben'**
  String get moveStoreUp;

  /// No description provided for @moveStoreDown.
  ///
  /// In de, this message translates to:
  /// **'Laden nach unten'**
  String get moveStoreDown;

  /// No description provided for @moveCategoryUp.
  ///
  /// In de, this message translates to:
  /// **'Kategorie nach oben'**
  String get moveCategoryUp;

  /// No description provided for @moveCategoryDown.
  ///
  /// In de, this message translates to:
  /// **'Kategorie nach unten'**
  String get moveCategoryDown;

  /// No description provided for @listHint.
  ///
  /// In de, this message translates to:
  /// **'Tippen hakt ab · Nach links wischen bearbeitet · Halten und ziehen verschiebt'**
  String get listHint;

  /// No description provided for @listHintDismiss.
  ///
  /// In de, this message translates to:
  /// **'Verstanden'**
  String get listHintDismiss;

  /// No description provided for @reorderNeedsConnection.
  ///
  /// In de, this message translates to:
  /// **'Die Reihenfolge lässt sich nur mit Verbindung ändern.'**
  String get reorderNeedsConnection;

  /// No description provided for @suggestion.
  ///
  /// In de, this message translates to:
  /// **'Vorschlag: {label}'**
  String suggestion(String label);

  /// No description provided for @dueSuggestions.
  ///
  /// In de, this message translates to:
  /// **'Brauchen wir wieder?'**
  String get dueSuggestions;

  /// Settings section header and list menu entry for account export and deletion.
  ///
  /// In de, this message translates to:
  /// **'Konto'**
  String get account;

  /// No description provided for @accountExport.
  ///
  /// In de, this message translates to:
  /// **'Meine Daten exportieren'**
  String get accountExport;

  /// No description provided for @accountExportBody.
  ///
  /// In de, this message translates to:
  /// **'Alles, was über dich gespeichert ist, als JSON-Datei.'**
  String get accountExportBody;

  /// No description provided for @accountDelete.
  ///
  /// In de, this message translates to:
  /// **'Konto löschen'**
  String get accountDelete;

  /// No description provided for @accountDeleteTitle.
  ///
  /// In de, this message translates to:
  /// **'Konto löschen?'**
  String get accountDeleteTitle;

  /// No description provided for @accountDeleteWhat.
  ///
  /// In de, this message translates to:
  /// **'Dein Konto, dein Profil, deine Zugangs-Tokens und deine verbundenen Apps werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.'**
  String get accountDeleteWhat;

  /// No description provided for @accountDeleteKept.
  ///
  /// In de, this message translates to:
  /// **'Der Haushalt „{household}“ bleibt für {names} mit der ganzen Liste erhalten. Deine Einträge bleiben dort, aber ohne deinen Namen.'**
  String accountDeleteKept(String household, String names);

  /// No description provided for @accountDeleteKeptUnnamed.
  ///
  /// In de, this message translates to:
  /// **'Der Haushalt „{household}“ bleibt für die anderen Mitglieder mit der ganzen Liste erhalten. Deine Einträge bleiben dort, aber ohne deinen Namen.'**
  String accountDeleteKeptUnnamed(String household);

  /// Joins the last two names of a list, e.g. 'Lea und Max'.
  ///
  /// In de, this message translates to:
  /// **'{first} und {last}'**
  String namesAnd(String first, String last);

  /// No description provided for @accountDeleteDeleted.
  ///
  /// In de, this message translates to:
  /// **'Du bist das letzte Mitglied. Deshalb wird der Haushalt „{household}“ mit Liste, Verlauf, Kategorien und Geschäften gelöscht.'**
  String accountDeleteDeleted(String household);

  /// No description provided for @accountDeleteNone.
  ///
  /// In de, this message translates to:
  /// **'Du bist in keinem Haushalt, geteilte Daten gibt es nicht.'**
  String get accountDeleteNone;

  /// No description provided for @accountDeleteExportHint.
  ///
  /// In de, this message translates to:
  /// **'Mit „Meine Daten exportieren“ unter Konto kannst du vorher eine Kopie sichern.'**
  String get accountDeleteExportHint;

  /// No description provided for @accountDeleteConfirmLabel.
  ///
  /// In de, this message translates to:
  /// **'Zum Bestätigen LÖSCHEN eingeben'**
  String get accountDeleteConfirmLabel;

  /// No description provided for @accountDeleteConfirm.
  ///
  /// In de, this message translates to:
  /// **'Endgültig löschen'**
  String get accountDeleteConfirm;

  /// No description provided for @accountDeleteOffline.
  ///
  /// In de, this message translates to:
  /// **'Keine Internetverbindung. Dein Konto wurde nicht gelöscht. Versuche es erneut, sobald du online bist.'**
  String get accountDeleteOffline;

  /// No description provided for @accountDeleteFailed.
  ///
  /// In de, this message translates to:
  /// **'Löschen fehlgeschlagen ({code}). Dein Konto wurde nicht gelöscht.'**
  String accountDeleteFailed(String code);

  /// No description provided for @accountDeleteCanceled.
  ///
  /// In de, this message translates to:
  /// **'Abgebrochen. Dein Konto wurde nicht gelöscht.'**
  String get accountDeleteCanceled;

  /// No description provided for @accountFateOffline.
  ///
  /// In de, this message translates to:
  /// **'Keine Internetverbindung. Was mit deinem Haushalt passiert, konnte nicht geladen werden.'**
  String get accountFateOffline;

  /// No description provided for @accountFateFailed.
  ///
  /// In de, this message translates to:
  /// **'Was mit deinem Haushalt passiert, konnte nicht geladen werden ({code}).'**
  String accountFateFailed(String code);

  /// No description provided for @accountDeletedNotice.
  ///
  /// In de, this message translates to:
  /// **'Dein Konto wurde gelöscht.'**
  String get accountDeletedNotice;

  /// No description provided for @accountDeletedApple.
  ///
  /// In de, this message translates to:
  /// **'Falls du dich mit Apple angemeldet hattest: Entferne „Hummlist“ auf deinem iPhone unter Einstellungen › [dein Name] › Anmelden & Sicherheit › Mit Apple anmelden.'**
  String get accountDeletedApple;

  /// No description provided for @exportDone.
  ///
  /// In de, this message translates to:
  /// **'Daten exportiert'**
  String get exportDone;

  /// No description provided for @exportDoneAt.
  ///
  /// In de, this message translates to:
  /// **'Daten exportiert: {path}'**
  String exportDoneAt(String path);

  /// No description provided for @exportOffline.
  ///
  /// In de, this message translates to:
  /// **'Keine Internetverbindung. Deine Daten wurden nicht exportiert.'**
  String get exportOffline;

  /// No description provided for @exportFailed.
  ///
  /// In de, this message translates to:
  /// **'Export fehlgeschlagen ({code}).'**
  String exportFailed(String code);

  /// The List tab
  ///
  /// In de, this message translates to:
  /// **'Liste'**
  String get tabList;

  /// The More tab: settings, sign-out, legal
  ///
  /// In de, this message translates to:
  /// **'Mehr'**
  String get tabMore;

  /// Under the open add sheet, where the tabs were
  ///
  /// In de, this message translates to:
  /// **'Antippen fügt hinzu · ↵ nimmt den ersten Vorschlag'**
  String get addSheetHint;

  /// The add sheet's store chip before a store is known
  ///
  /// In de, this message translates to:
  /// **'Laden: automatisch'**
  String get storeAuto;

  /// The add sheet with nothing typed and nothing due
  ///
  /// In de, this message translates to:
  /// **'Tippe, um Vorschläge zu sehen'**
  String get typeToSuggest;

  /// Source of the first add suggestion
  ///
  /// In de, this message translates to:
  /// **'Wie getippt'**
  String get suggestionTyped;

  /// Source label of an add suggestion
  ///
  /// In de, this message translates to:
  /// **'Schon mal gekauft'**
  String get suggestionHistory;

  /// Source label of an add suggestion
  ///
  /// In de, this message translates to:
  /// **'Andere Packung'**
  String get suggestionPack;

  /// Source label of an add suggestion
  ///
  /// In de, this message translates to:
  /// **'Andere Sorte'**
  String get suggestionVariant;

  /// Source label of an add suggestion
  ///
  /// In de, this message translates to:
  /// **'Andere Größe'**
  String get suggestionSize;

  /// Source label of an add suggestion
  ///
  /// In de, this message translates to:
  /// **'Andere Marke'**
  String get suggestionBrand;

  /// Source label of an add suggestion
  ///
  /// In de, this message translates to:
  /// **'Aus dem Katalog'**
  String get suggestionCatalog;

  /// Source label of a due usual in the add sheet
  ///
  /// In de, this message translates to:
  /// **'Wieder fällig'**
  String get suggestionDue;

  /// The add sheet's note after an add
  ///
  /// In de, this message translates to:
  /// **'Hinzugefügt: {name} → {store}'**
  String addedTo(String name, String store);

  /// The add sheet's note after an add without a store
  ///
  /// In de, this message translates to:
  /// **'Hinzugefügt: {name}'**
  String addedItem(String name);

  /// Clears the add field
  ///
  /// In de, this message translates to:
  /// **'Eingabe leeren'**
  String get clearInput;

  /// Open items, under the list title
  ///
  /// In de, this message translates to:
  /// **'{count, plural, =1{1 Artikel} other{{count} Artikel}}'**
  String listItemCount(int count);

  /// More: section
  ///
  /// In de, this message translates to:
  /// **'Haushalt'**
  String get household;

  /// More: the stores screen
  ///
  /// In de, this message translates to:
  /// **'Läden'**
  String get storesTitle;

  /// More: under Läden
  ///
  /// In de, this message translates to:
  /// **'Reihenfolge und Laufweg'**
  String get storesRowHint;

  /// Stores screen hint
  ///
  /// In de, this message translates to:
  /// **'Halten und ziehen ändert die Reihenfolge der Läden in der Liste. Ein Laden öffnet seinen Laufweg.'**
  String get storesHint;

  /// Drag handle of a store
  ///
  /// In de, this message translates to:
  /// **'{store} verschieben'**
  String dragStore(String store);

  /// More: under Zugänge
  ///
  /// In de, this message translates to:
  /// **'MCP-Server, Zugangsschlüssel, verbundene Apps'**
  String get accessRowHint;

  /// More: under Konto
  ///
  /// In de, this message translates to:
  /// **'Daten exportieren, Konto löschen'**
  String get accountRowHint;

  /// More: the settings page (theme, language)
  ///
  /// In de, this message translates to:
  /// **'Einstellungen'**
  String get settingsTitle;

  /// More: under Einstellungen
  ///
  /// In de, this message translates to:
  /// **'Darstellung und Sprache'**
  String get settingsRowHint;

  /// Settings: section with the light/dark switch
  ///
  /// In de, this message translates to:
  /// **'Darstellung'**
  String get appearance;

  /// Theme option: follow the device's light or dark setting
  ///
  /// In de, this message translates to:
  /// **'Wie Gerät'**
  String get themeSystem;

  /// Theme option: always light
  ///
  /// In de, this message translates to:
  /// **'Hell'**
  String get themeLight;

  /// Theme option: always dark
  ///
  /// In de, this message translates to:
  /// **'Dunkel'**
  String get themeDark;

  /// Settings: section, row and page title
  ///
  /// In de, this message translates to:
  /// **'Sprache'**
  String get language;

  /// Language option: follow the device
  ///
  /// In de, this message translates to:
  /// **'Wie Gerät'**
  String get languageSystem;

  /// Under the device option: the language the device gives now, in its own name
  ///
  /// In de, this message translates to:
  /// **'Gerade {language}'**
  String languageSystemNow(String language);

  /// Settings: the language row while it follows the device
  ///
  /// In de, this message translates to:
  /// **'Wie Gerät ({language})'**
  String languageSystemPicked(String language);

  /// More: section
  ///
  /// In de, this message translates to:
  /// **'Rechtliches'**
  String get legal;

  /// More: legal notice
  ///
  /// In de, this message translates to:
  /// **'Impressum'**
  String get imprint;

  /// More: privacy policy
  ///
  /// In de, this message translates to:
  /// **'Datenschutz'**
  String get privacy;

  /// More: open-source licenses
  ///
  /// In de, this message translates to:
  /// **'Lizenzen'**
  String get licenses;

  /// More: bottom line
  ///
  /// In de, this message translates to:
  /// **'Version {version}'**
  String appVersion(String version);

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Obst & Gemüse'**
  String get categoryProduce;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Brot & Backwaren'**
  String get categoryBakery;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Kühlregal'**
  String get categoryChilled;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Fleisch/Wurst/Fisch'**
  String get categoryMeat;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Vorrat & Konserven'**
  String get categoryPantry;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Süßes & Snacks'**
  String get categorySweets;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Getränke'**
  String get categoryDrinks;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Tiefkühl'**
  String get categoryFrozen;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Haushalt'**
  String get categoryHousehold;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'👶 Drogerie'**
  String get categoryDrugstore;

  /// Seeded category, exactly as public.seed_household names it in German
  ///
  /// In de, this message translates to:
  /// **'Sonstiges'**
  String get categoryOther;

  /// Analytics consent screen after the first sign-in: title. approved by Peter 2026-10-30 (legal review H-03)
  ///
  /// In de, this message translates to:
  /// **'Darf Hummlist Nutzungsdaten erfassen?'**
  String get analyticsConsentTitle;

  /// Analytics consent screen: who asks, why, what is stored and sent and what never is, how to withdraw. Ends right before analyticsConsentPrivacyLink, which follows after a space and is closed by a full stop. approved by Peter 2026-10-30 (legal review H-03)
  ///
  /// In de, this message translates to:
  /// **'Peter Trost, der Anbieter von Hummlist, möchte verstehen, welche Funktionen genutzt werden, Fehler finden und messen, ob sich Hummlist wirtschaftlich trägt. Dafür speichert Hummlist mit deiner Erlaubnis eine zufällige Kennung auf diesem Gerät und sendet Nutzungsdaten und Fehlerberichte an unseren Dienstleister PostHog (Server in der EU): zum Beispiel, dass ein Artikel hinzugefügt oder abgehakt wurde, mit dieser Kennung, der Kennung deines Haushalts, Plattform und App-Version. Die Daten sind pseudonym, nicht anonym. Artikelnamen, Listeninhalte, Namen, E-Mail-Adressen, IP-Adresse und Standort werden nie gesendet. Ohne Erlaubnis wird nichts gespeichert oder gesendet. Du kannst die Erlaubnis jederzeit unter Mehr → Nutzungsdaten widerrufen. Mehr in der'**
  String get analyticsConsentBody;

  /// Analytics consent screen: the link to the privacy policy that ends analyticsConsentBody. approved by Peter 2026-10-30 (legal review H-03)
  ///
  /// In de, this message translates to:
  /// **'Datenschutzerklärung'**
  String get analyticsConsentPrivacyLink;

  /// Analytics consent: allow
  ///
  /// In de, this message translates to:
  /// **'Einverstanden'**
  String get analyticsAccept;

  /// Analytics consent: decline; as prominent as allow
  ///
  /// In de, this message translates to:
  /// **'Ablehnen'**
  String get analyticsDecline;

  /// More: section with the analytics switch
  ///
  /// In de, this message translates to:
  /// **'Nutzungsdaten'**
  String get analyticsSection;

  /// More: analytics switch. approved by Peter 2026-10-30 (legal review H-03)
  ///
  /// In de, this message translates to:
  /// **'Nutzungsdaten und Fehlerberichte senden'**
  String get analyticsToggle;

  /// More: below the analytics switch. Turning it off deletes the install id. approved by Peter 2026-10-30 (legal review H-03)
  ///
  /// In de, this message translates to:
  /// **'Pseudonym an PostHog (Server in der EU), ohne Listeninhalte. Gilt für dieses Gerät. Ausschalten löscht die Kennung auf diesem Gerät.'**
  String get analyticsToggleHint;

  /// More: shown under the version while this install is marked internal (its analytics are filtered out)
  ///
  /// In de, this message translates to:
  /// **'Interne Installation'**
  String get internalInstall;

  /// Snackbar after a long press on the version marks the install internal
  ///
  /// In de, this message translates to:
  /// **'Diese Installation zählt jetzt als intern.'**
  String get internalInstallOn;

  /// Snackbar after a long press on the version unmarks the install
  ///
  /// In de, this message translates to:
  /// **'Diese Installation zählt nicht mehr als intern.'**
  String get internalInstallOff;

  /// More, internal installs only: raises a test exception for error tracking
  ///
  /// In de, this message translates to:
  /// **'Testfehler senden'**
  String get sendTestError;

  /// More: section heading above Feedback senden
  ///
  /// In de, this message translates to:
  /// **'Feedback'**
  String get feedbackSection;

  /// More: opens the feedback form; also the form's title
  ///
  /// In de, this message translates to:
  /// **'Feedback senden'**
  String get feedbackRow;

  /// More: under Feedback senden
  ///
  /// In de, this message translates to:
  /// **'Fehler, Ideen und Fragen an Peter'**
  String get feedbackRowHint;

  /// Feedback form: label of the text field
  ///
  /// In de, this message translates to:
  /// **'Deine Nachricht'**
  String get feedbackMessage;

  /// Feedback form: hint in the empty text field
  ///
  /// In de, this message translates to:
  /// **'Was ist dir aufgefallen?'**
  String get feedbackMessageHint;

  /// Feedback form: category chip
  ///
  /// In de, this message translates to:
  /// **'Bug'**
  String get feedbackCategoryBug;

  /// Feedback form: category chip
  ///
  /// In de, this message translates to:
  /// **'Idee'**
  String get feedbackCategoryIdea;

  /// Feedback form: category chip
  ///
  /// In de, this message translates to:
  /// **'Sonstiges'**
  String get feedbackCategoryOther;

  /// Feedback form: label above the category chips
  ///
  /// In de, this message translates to:
  /// **'Art (optional)'**
  String get feedbackCategories;

  /// Feedback form: checkbox, off by default
  ///
  /// In de, this message translates to:
  /// **'Peter darf mich dazu kontaktieren'**
  String get feedbackContact;

  /// Feedback form: what is sent along with the note
  ///
  /// In de, this message translates to:
  /// **'App-Version, Gerät, Sprache und aktueller Bildschirm. Keine Listeneinträge.'**
  String get feedbackAttached;

  /// Feedback form: before the attached line
  ///
  /// In de, this message translates to:
  /// **'Wird mitgeschickt:'**
  String get feedbackAttachedTitle;

  /// Feedback form: send button
  ///
  /// In de, this message translates to:
  /// **'Senden'**
  String get feedbackSend;

  /// Feedback form: button after a failed send
  ///
  /// In de, this message translates to:
  /// **'Erneut senden'**
  String get feedbackRetry;

  /// Feedback form: while the note is on its way (screen readers)
  ///
  /// In de, this message translates to:
  /// **'Wird gesendet …'**
  String get feedbackSending;

  /// Snackbar after the note arrived
  ///
  /// In de, this message translates to:
  /// **'Danke!'**
  String get feedbackThanks;

  /// Feedback form: error after a failed send; text, category and checkbox stay
  ///
  /// In de, this message translates to:
  /// **'Nicht gesendet. Prüfe die Verbindung und versuch es noch einmal.'**
  String get feedbackFailed;

  /// Feedback form: the note is too long
  ///
  /// In de, this message translates to:
  /// **'Höchstens {max} Zeichen'**
  String feedbackTooLong(int max);

  /// Feedback form: characters used, shown near the limit
  ///
  /// In de, this message translates to:
  /// **'{count} / {max}'**
  String feedbackCounter(int count, int max);

  /// Feedback form: close button
  ///
  /// In de, this message translates to:
  /// **'Schließen'**
  String get feedbackClose;

  /// No description provided for @onboardingCreateHint.
  ///
  /// In de, this message translates to:
  /// **'Eine neue Liste, zu der du danach deinen Partner einlädst.'**
  String get onboardingCreateHint;

  /// No description provided for @onboardingJoin.
  ///
  /// In de, this message translates to:
  /// **'Einladung annehmen'**
  String get onboardingJoin;

  /// No description provided for @onboardingJoinHint.
  ///
  /// In de, this message translates to:
  /// **'Du hast einen Link oder einen Code bekommen.'**
  String get onboardingJoinHint;

  /// No description provided for @householdNameInvalid.
  ///
  /// In de, this message translates to:
  /// **'Gib einen Namen mit 1 bis 80 Zeichen ein.'**
  String get householdNameInvalid;

  /// No description provided for @storesChoice.
  ///
  /// In de, this message translates to:
  /// **'Läden'**
  String get storesChoice;

  /// No description provided for @defaultStores.
  ///
  /// In de, this message translates to:
  /// **'Deutsche Standard-Läden hinzufügen'**
  String get defaultStores;

  /// No description provided for @defaultStoresHint.
  ///
  /// In de, this message translates to:
  /// **'dm, Lidl und Edeka, jeweils in ihrer Gangfolge'**
  String get defaultStoresHint;

  /// No description provided for @skipStores.
  ///
  /// In de, this message translates to:
  /// **'Überspringen'**
  String get skipStores;

  /// No description provided for @skipStoresHint.
  ///
  /// In de, this message translates to:
  /// **'Ohne Läden starten. Du kannst sie später unter Mehr anlegen.'**
  String get skipStoresHint;

  /// No description provided for @householdOffline.
  ///
  /// In de, this message translates to:
  /// **'Keine Internetverbindung. Versuche es erneut, sobald du online bist.'**
  String get householdOffline;

  /// No description provided for @tooManyAttempts.
  ///
  /// In de, this message translates to:
  /// **'Zu viele Versuche. Bitte später noch einmal.'**
  String get tooManyAttempts;

  /// No description provided for @alreadyInHousehold.
  ///
  /// In de, this message translates to:
  /// **'Du bist schon in einem Haushalt'**
  String get alreadyInHousehold;

  /// No description provided for @switchHouseholdAlone.
  ///
  /// In de, this message translates to:
  /// **'Du bist das einzige Mitglied von „{household}“. Trittst du bei, wird „{household}“ mit seiner Liste gelöscht.'**
  String switchHouseholdAlone(String household);

  /// No description provided for @switchHouseholdShared.
  ///
  /// In de, this message translates to:
  /// **'Trittst du bei, verlässt du „{household}“. Die anderen Mitglieder behalten die Liste.'**
  String switchHouseholdShared(String household);

  /// No description provided for @inviteCheck.
  ///
  /// In de, this message translates to:
  /// **'Weiter'**
  String get inviteCheck;

  /// No description provided for @invitePreview.
  ///
  /// In de, this message translates to:
  /// **'Einladung in den Haushalt'**
  String get invitePreview;

  /// No description provided for @invitePartnerBody.
  ///
  /// In de, this message translates to:
  /// **'Teile den Link oder den Code mit der Person, mit der du einkaufst. Die Einladung gilt 7 Tage und für eine Person.'**
  String get invitePartnerBody;

  /// No description provided for @later.
  ///
  /// In de, this message translates to:
  /// **'Später'**
  String get later;

  /// No description provided for @toTheList.
  ///
  /// In de, this message translates to:
  /// **'Weiter zur Liste'**
  String get toTheList;

  /// No description provided for @inviteShareText.
  ///
  /// In de, this message translates to:
  /// **'Komm in unseren Hummlist-Haushalt: {link} · Code: {code}'**
  String inviteShareText(String link, String code);

  /// No description provided for @inviteShareTextCodeOnly.
  ///
  /// In de, this message translates to:
  /// **'Komm in unseren Hummlist-Haushalt. Code: {code}'**
  String inviteShareTextCodeOnly(String code);

  /// No description provided for @share.
  ///
  /// In de, this message translates to:
  /// **'Teilen'**
  String get share;

  /// No description provided for @copyLink.
  ///
  /// In de, this message translates to:
  /// **'Link kopieren'**
  String get copyLink;

  /// No description provided for @copyCode.
  ///
  /// In de, this message translates to:
  /// **'Code kopieren'**
  String get copyCode;

  /// No description provided for @linkCopied.
  ///
  /// In de, this message translates to:
  /// **'Link kopiert'**
  String get linkCopied;

  /// No description provided for @codeCopied.
  ///
  /// In de, this message translates to:
  /// **'Code kopiert'**
  String get codeCopied;

  /// No description provided for @invitesTitle.
  ///
  /// In de, this message translates to:
  /// **'Einladungen'**
  String get invitesTitle;

  /// No description provided for @invitesOpen.
  ///
  /// In de, this message translates to:
  /// **'Offene Einladungen'**
  String get invitesOpen;

  /// No description provided for @invitesEmpty.
  ///
  /// In de, this message translates to:
  /// **'Keine offenen Einladungen.'**
  String get invitesEmpty;

  /// No description provided for @newInvite.
  ///
  /// In de, this message translates to:
  /// **'Neue Einladung'**
  String get newInvite;

  /// No description provided for @inviteValidUntil.
  ///
  /// In de, this message translates to:
  /// **'gültig bis {date}, {time} Uhr'**
  String inviteValidUntil(DateTime date, DateTime time);

  /// No description provided for @inviteRevoke.
  ///
  /// In de, this message translates to:
  /// **'Widerrufen'**
  String get inviteRevoke;

  /// No description provided for @inviteRevokeLabel.
  ///
  /// In de, this message translates to:
  /// **'Einladung {code} widerrufen'**
  String inviteRevokeLabel(String code);

  /// No description provided for @inviteRevoked.
  ///
  /// In de, this message translates to:
  /// **'Einladung widerrufen. Link und Code gelten nicht mehr.'**
  String get inviteRevoked;

  /// No description provided for @retry.
  ///
  /// In de, this message translates to:
  /// **'Erneut versuchen'**
  String get retry;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['de', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
