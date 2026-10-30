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
  String get addFieldHint => 'What do you need?';

  @override
  String get addButton => 'Add';

  @override
  String get emptyList => 'The list is empty. Type below what you need.';

  @override
  String get sortingItem => 'Sorting …';

  @override
  String get recentlyUsed => 'Recently used';

  @override
  String get readd => 'Back on the list';

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
    return '$name is already on the list';
  }

  @override
  String get dedupeMerge => 'Merge';

  @override
  String dedupeMerged(String item) {
    return 'Merged: $item';
  }

  @override
  String mergeRefused(String name) {
    return 'Couldn\'t merge $name';
  }

  @override
  String get dictationStart => 'Dictate';

  @override
  String get dictationStop => 'Stop dictation';

  @override
  String get dictationListening => 'Listening …';

  @override
  String get dictationUnavailable =>
      'Voice input isn\'t available. Allow microphone and speech recognition in Settings.';

  @override
  String get dictationNoOfflineGerman =>
      'Dictation only works offline, so your voice stays on the device. This device is missing German offline speech recognition. Download it in the system settings or type the item instead.';

  @override
  String get dictationNothingHeard => 'I didn\'t hear anything.';

  @override
  String get dictationNothingUnderstood =>
      'I didn\'t catch anything for the list.';

  @override
  String get dictationSplitFailed =>
      'No connection. The text is in the field; check it and tap Add.';

  @override
  String dictationAdded(String items) {
    return 'Added: $items.';
  }

  @override
  String dictationAlreadyOnList(String items) {
    return 'Already on the list: $items.';
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
  String get save => 'Save';

  @override
  String get cancel => 'Cancel';

  @override
  String get delete => 'Delete';

  @override
  String get offline =>
      'Offline: changes will sync once the connection is back';

  @override
  String pendingChanges(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Syncing $count changes',
      one: 'Syncing 1 change',
    );
    return '$_temp0';
  }

  @override
  String syncFailed(String name) {
    return 'Change refused: $name';
  }

  @override
  String get menu => 'Menu';

  @override
  String get inviteMember => 'Invite your partner';

  @override
  String get joinOtherHousehold => 'Join another household';

  @override
  String get signOut => 'Sign out';

  @override
  String get inviteTitle => 'Invite member';

  @override
  String get inviteBody =>
      'Enter this code in the app or share the link. The invite is valid for 7 days and for one person.';

  @override
  String get inviteCodeLabel => 'Code';

  @override
  String get inviteLinkLabel => 'Link';

  @override
  String get copy => 'Copy';

  @override
  String get copied => 'Copied';

  @override
  String get close => 'Close';

  @override
  String get signInTitle => 'Sign in';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get signIn => 'Sign in';

  @override
  String get signUp => 'Sign up';

  @override
  String get sendMagicLink => 'Email me a sign-in link';

  @override
  String get magicLinkSent =>
      'We sent you a sign-in link. Open it on this device.';

  @override
  String get signUpCheckEmail =>
      'Please confirm your email address with the link we sent you.';

  @override
  String get invalidEmail => 'Please enter a valid email address';

  @override
  String get passwordTooShort => 'At least 6 characters';

  @override
  String authFailed(String message) {
    return 'Sign-in failed: $message';
  }

  @override
  String get signInWithGoogle => 'Sign in with Google';

  @override
  String get signInWithApple => 'Sign in with Apple';

  @override
  String get signInCanceled => 'Sign-in canceled';

  @override
  String get orWithEmail => 'or with email';

  @override
  String get onboardingTitle => 'Welcome to Hummlist';

  @override
  String get onboardingBody =>
      'Hummlist shares one shopping list with everyone in your household. Create a new household or accept an invite.';

  @override
  String get householdName => 'Household name';

  @override
  String get householdNameDefault => 'Our household';

  @override
  String get createHousehold => 'Create a household';

  @override
  String get inviteCode => 'Invite code';

  @override
  String get joinHousehold => 'Join household';

  @override
  String get invalidInvite => 'This code is invalid or has expired.';

  @override
  String get switchHouseholdWarning =>
      'You\'ll leave your current household. If you\'re the last member, it\'s deleted along with its list.';

  @override
  String genericError(String message) {
    return 'Something went wrong: $message';
  }

  @override
  String get loading => 'Loading …';

  @override
  String get consentTitle => 'Allow access?';

  @override
  String consentSignedInAs(String email) {
    return 'Signed in as $email';
  }

  @override
  String consentHousehold(String name) {
    return 'Household: $name';
  }

  @override
  String consentWants(String client) {
    return '$client wants to:';
  }

  @override
  String consentListAccess(String client) {
    return 'Read, add, tick off and move items on your shopping list. $client and its provider will receive your list contents.';
  }

  @override
  String get scopeOpenid => 'Confirm your sign-in';

  @override
  String get scopeEmail => 'Your email address';

  @override
  String get scopeProfile => 'Your name and profile';

  @override
  String get scopePhone => 'Your phone number';

  @override
  String get scopeOfflineAccess => 'Stay signed in';

  @override
  String get consentAllow => 'Allow';

  @override
  String get consentDeny => 'Deny';

  @override
  String get redirecting => 'Redirecting …';

  @override
  String get consentInvalid =>
      'This request is invalid or has expired. Start the connection again in your app.';

  @override
  String get accessTitle => 'Access';

  @override
  String get mcpServer => 'MCP server';

  @override
  String get mcpServerBody =>
      'For Claude, ChatGPT and other AI assistants. Connect by signing in (OAuth) or with an access token.';

  @override
  String get accessTokens => 'Access tokens';

  @override
  String get noTokens => 'No active token.';

  @override
  String tokenHint(String hint) {
    return '…$hint';
  }

  @override
  String createdOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Created $dateString';
  }

  @override
  String lastUsedOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Last used $dateString';
  }

  @override
  String get neverUsed => 'Never used';

  @override
  String get createToken => 'Create token';

  @override
  String get create => 'Create';

  @override
  String get tokenName => 'Name';

  @override
  String get tokenNameHint => 'e.g. Claude or Siri';

  @override
  String get tokenCreated => 'Token created';

  @override
  String get tokenShownOnce => 'Copy the token now. It won\'t be shown again.';

  @override
  String get done => 'Done';

  @override
  String revokeToken(String name) {
    return 'Revoke $name';
  }

  @override
  String get revokeTokenTitle => 'Revoke token?';

  @override
  String get revokeTokenBody => 'Apps using it lose access right away.';

  @override
  String get revoke => 'Revoke';

  @override
  String get tooManyTokens => 'At most 20 active tokens.';

  @override
  String get connectedApps => 'Connected apps';

  @override
  String get noConnectedApps => 'No apps connected yet.';

  @override
  String connectedOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Connected $dateString';
  }

  @override
  String get disconnect => 'Disconnect';

  @override
  String disconnectApp(String name) {
    return 'Disconnect $name';
  }

  @override
  String disconnectTitle(String name) {
    return 'Disconnect $name?';
  }

  @override
  String get disconnectBody => 'The app loses access to your list right away.';

  @override
  String get editStoreLayout => 'Edit order';

  @override
  String get manageCategories => 'Manage categories';

  @override
  String get categoriesTitle => 'Categories';

  @override
  String get categoriesHint =>
      'Items without a store, and stores without their own order, follow this order. Tap a category to rename it.';

  @override
  String get categoryName => 'Name';

  @override
  String get renameCategory => 'Rename category';

  @override
  String get addCategory => 'Add category';

  @override
  String deleteCategory(String name) {
    return 'Delete $name';
  }

  @override
  String get moveItemsTo => 'Move items to';

  @override
  String dragCategory(String name) {
    return 'Move $name';
  }

  @override
  String categoryNameTaken(String name) {
    return 'A category named “$name” already exists.';
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
    return '$count new from $name';
  }

  @override
  String newItems(int count) {
    return '$count new';
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
  String get listHint =>
      'Tap ticks off · Swipe left edits · Hold and drag moves';

  @override
  String get listHintDismiss => 'Got it';

  @override
  String get reorderNeedsConnection => 'Reordering needs a connection.';

  @override
  String suggestion(String label) {
    return 'Suggestion: $label';
  }

  @override
  String get dueSuggestions => 'Need these again?';

  @override
  String get account => 'Account';

  @override
  String get accountExport => 'Export my data';

  @override
  String get accountExportBody =>
      'Everything stored about you, as a JSON file.';

  @override
  String get accountDelete => 'Delete account';

  @override
  String get accountDeleteTitle => 'Delete account?';

  @override
  String get accountDeleteWhat =>
      'Your account, profile, access tokens and connected apps will be deleted for good. This can\'t be undone.';

  @override
  String accountDeleteKept(String household, String names) {
    return 'The household “$household” stays with $names, list and all. Your items stay there, but without your name.';
  }

  @override
  String accountDeleteKeptUnnamed(String household) {
    return 'The household “$household” stays with the other members, list and all. Your items stay there, but without your name.';
  }

  @override
  String namesAnd(String first, String last) {
    return '$first and $last';
  }

  @override
  String accountDeleteDeleted(String household) {
    return 'You\'re the last member, so the household “$household” will be deleted with its list, history, categories and stores.';
  }

  @override
  String get accountDeleteNone =>
      'You\'re not in a household, so there\'s no shared data.';

  @override
  String get accountDeleteExportHint =>
      'To keep a copy first, use “Export my data” under Account.';

  @override
  String get accountDeleteConfirmLabel => 'Type DELETE to confirm';

  @override
  String get accountDeleteConfirm => 'Delete for good';

  @override
  String get accountDeleteOffline =>
      'No internet connection. Your account was not deleted. Try again once you\'re online.';

  @override
  String accountDeleteFailed(String code) {
    return 'Deletion failed ($code). Your account was not deleted.';
  }

  @override
  String get accountDeleteCanceled => 'Canceled. Your account was not deleted.';

  @override
  String get accountFateOffline =>
      'No internet connection. Couldn\'t load what happens to your household.';

  @override
  String accountFateFailed(String code) {
    return 'Couldn\'t load what happens to your household ($code).';
  }

  @override
  String get accountDeletedNotice => 'Your account was deleted.';

  @override
  String get accountDeletedApple =>
      'If you signed in with Apple, remove “Hummlist” on your iPhone under Settings › [your name] › Sign-In & Security › Sign in with Apple.';

  @override
  String get exportDone => 'Data exported';

  @override
  String exportDoneAt(String path) {
    return 'Data exported: $path';
  }

  @override
  String get exportOffline =>
      'No internet connection. Your data was not exported.';

  @override
  String exportFailed(String code) {
    return 'Export failed ($code).';
  }

  @override
  String get tabList => 'List';

  @override
  String get tabMore => 'More';

  @override
  String get addSheetHint => 'Tap to add · ↵ takes the first suggestion';

  @override
  String get storeAuto => 'Store: automatic';

  @override
  String get typeToSuggest => 'Type to see suggestions';

  @override
  String get suggestionTyped => 'As typed';

  @override
  String get suggestionHistory => 'Bought before';

  @override
  String get suggestionPack => 'Other pack';

  @override
  String get suggestionVariant => 'Other kind';

  @override
  String get suggestionSize => 'Other size';

  @override
  String get suggestionBrand => 'Other brand';

  @override
  String get suggestionCatalog => 'From the catalogue';

  @override
  String get suggestionDue => 'Due again';

  @override
  String addedTo(String name, String store) {
    return 'Added: $name → $store';
  }

  @override
  String addedItem(String name) {
    return 'Added: $name';
  }

  @override
  String get clearInput => 'Clear';

  @override
  String listItemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String get household => 'Household';

  @override
  String get storesTitle => 'Stores';

  @override
  String get storesRowHint => 'Order and walking route';

  @override
  String get storesHint =>
      'Drag to change the order of the stores in the list. Tap a store to edit its walking route.';

  @override
  String dragStore(String store) {
    return 'Move $store';
  }

  @override
  String get accessRowHint => 'MCP server, access tokens, connected apps';

  @override
  String get accountRowHint => 'Export your data, delete your account';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsRowHint => 'Appearance and language';

  @override
  String get appearance => 'Appearance';

  @override
  String get themeSystem => 'Device';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get language => 'Language';

  @override
  String get languageSystem => 'Device';

  @override
  String languageSystemNow(String language) {
    return 'Currently $language';
  }

  @override
  String languageSystemPicked(String language) {
    return 'Device ($language)';
  }

  @override
  String get legal => 'Legal';

  @override
  String get imprint => 'Imprint';

  @override
  String get privacy => 'Privacy';

  @override
  String get licenses => 'Licenses';

  @override
  String appVersion(String version) {
    return 'Version $version';
  }

  @override
  String get categoryProduce => 'Fruit & veg';

  @override
  String get categoryBakery => 'Bread & bakery';

  @override
  String get categoryChilled => 'Chilled';

  @override
  String get categoryMeat => 'Meat & fish';

  @override
  String get categoryPantry => 'Pantry';

  @override
  String get categorySweets => 'Sweets & snacks';

  @override
  String get categoryDrinks => 'Drinks';

  @override
  String get categoryFrozen => 'Frozen';

  @override
  String get categoryHousehold => 'Household';

  @override
  String get categoryDrugstore => '👶 Drugstore';

  @override
  String get categoryOther => 'Other';

  @override
  String get analyticsConsentTitle => 'May Hummlist collect usage data?';

  @override
  String get analyticsConsentBody =>
      'Peter Trost, who runs Hummlist, wants to see which features are used, find bugs and measure whether Hummlist pays for itself. For that, with your permission, Hummlist stores a random ID on this device and sends usage data and error reports to our service provider PostHog (servers in the EU): for example that an item was added or ticked off, together with this ID, your household\'s ID, platform and app version. The data is pseudonymous, not anonymous. Item names, list contents, names, e-mail addresses, IP address and location are never sent. Without your permission nothing is stored or sent. You can withdraw your permission any time under More → Usage data. More in the';

  @override
  String get analyticsConsentPrivacyLink => 'privacy policy';

  @override
  String get analyticsAccept => 'Allow';

  @override
  String get analyticsDecline => 'Decline';

  @override
  String get analyticsSection => 'Usage data';

  @override
  String get analyticsToggle => 'Send usage data and error reports';

  @override
  String get analyticsToggleHint =>
      'Pseudonymous, to PostHog (servers in the EU), never list contents. Applies to this device. Turning it off deletes the ID on this device.';

  @override
  String get internalInstall => 'Internal installation';

  @override
  String get internalInstallOn => 'This installation now counts as internal.';

  @override
  String get internalInstallOff =>
      'This installation no longer counts as internal.';

  @override
  String get sendTestError => 'Send a test error';

  @override
  String get feedbackSection => 'Feedback';

  @override
  String get feedbackRow => 'Send feedback';

  @override
  String get feedbackRowHint => 'Bugs, ideas and questions for Peter';

  @override
  String get helpRow => 'Help & contact';

  @override
  String get helpRowHint => 'Questions, guides and our email address';

  @override
  String get feedbackMessage => 'Your message';

  @override
  String get feedbackMessageHint => 'What did you notice?';

  @override
  String get feedbackCategoryBug => 'Bug';

  @override
  String get feedbackCategoryIdea => 'Idea';

  @override
  String get feedbackCategoryOther => 'Other';

  @override
  String get feedbackCategories => 'Kind (optional)';

  @override
  String get feedbackContact => 'Peter may contact me about this';

  @override
  String get feedbackAttached =>
      'App version, device, language and current screen. No list items.';

  @override
  String get feedbackAttachedTitle => 'Sent along:';

  @override
  String get feedbackSend => 'Send';

  @override
  String get feedbackRetry => 'Retry';

  @override
  String get feedbackSending => 'Sending …';

  @override
  String get feedbackThanks => 'Thanks!';

  @override
  String get feedbackFailed => 'Not sent. Check your connection and try again.';

  @override
  String feedbackTooLong(int max) {
    return '$max characters at most';
  }

  @override
  String feedbackCounter(int count, int max) {
    return '$count / $max';
  }

  @override
  String get feedbackClose => 'Close';

  @override
  String get onboardingCreateHint =>
      'A new list; you invite your partner next.';

  @override
  String get onboardingJoin => 'Join with an invite';

  @override
  String get onboardingJoinHint => 'You got a link or a code.';

  @override
  String get householdNameInvalid => 'Enter a name of 1 to 80 characters.';

  @override
  String get storesChoice => 'Stores';

  @override
  String get defaultStores => 'Add default German stores';

  @override
  String get defaultStoresHint => 'dm, Lidl and Edeka, each in its aisle order';

  @override
  String get skipStores => 'Skip';

  @override
  String get skipStoresHint =>
      'Start without stores. You can add them later under More.';

  @override
  String get householdOffline =>
      'No internet connection. Try again once you\'re online.';

  @override
  String get tooManyAttempts => 'Too many attempts. Please try again later.';

  @override
  String get alreadyInHousehold => 'You\'re already in a household';

  @override
  String switchHouseholdAlone(String household) {
    return 'You\'re the only member of “$household”. If you join, “$household” is deleted along with its list.';
  }

  @override
  String switchHouseholdShared(String household) {
    return 'If you join, you leave “$household”. The other members keep its list.';
  }

  @override
  String get inviteCheck => 'Continue';

  @override
  String get invitePreview => 'Invite to the household';

  @override
  String get invitePartnerBody =>
      'Share the link or the code with the person you shop with. The invite is valid for 7 days and for one person.';

  @override
  String get later => 'Later';

  @override
  String get toTheList => 'Go to the list';

  @override
  String inviteShareText(String link, String code) {
    return 'Join our Hummlist household: $link · Code: $code';
  }

  @override
  String inviteShareTextCodeOnly(String code) {
    return 'Join our Hummlist household. Code: $code';
  }

  @override
  String get share => 'Share';

  @override
  String get copyLink => 'Copy link';

  @override
  String get copyCode => 'Copy code';

  @override
  String get linkCopied => 'Link copied';

  @override
  String get codeCopied => 'Code copied';

  @override
  String get invitesTitle => 'Invites';

  @override
  String get invitesOpen => 'Open invites';

  @override
  String get invitesEmpty => 'No open invites.';

  @override
  String get newInvite => 'New invite';

  @override
  String inviteValidUntil(DateTime date, DateTime time) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMMMMd(localeName);
    final String dateString = dateDateFormat.format(date);
    final intl.DateFormat timeDateFormat = intl.DateFormat.Hm(localeName);
    final String timeString = timeDateFormat.format(time);

    return 'valid until $dateString, $timeString';
  }

  @override
  String get inviteRevoke => 'Revoke';

  @override
  String inviteRevokeLabel(String code) {
    return 'Revoke invite $code';
  }

  @override
  String get inviteRevoked =>
      'Invite revoked. Its link and code no longer work.';

  @override
  String get retry => 'Try again';
}
