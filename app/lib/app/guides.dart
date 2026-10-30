import 'package:family_groceries/app/environment.dart';

/// The public guides on hummlist.com (`site/` in this repo). Slugs are
/// stable; the site serves German guides under /de/anleitungen and English
/// ones under /en/guides.
const guidesBaseUrl = 'https://hummlist.com';

/// The Siri Shortcut guide in the UI language: German for `de`, otherwise
/// the English page, which points German readers to the German guide.
Uri siriGuideUrl(String languageCode) => Uri.parse(
  languageCode == 'de'
      ? '$guidesBaseUrl/de/anleitungen/siri-kurzbefehl'
      : '$guidesBaseUrl/en/guides/siri-shortcut',
);

/// The imprint on hummlist.com (`site/content/legal/`), German or English.
Uri imprintUrl(String languageCode) => Uri.parse(
  languageCode == 'de'
      ? '$guidesBaseUrl/impressum'
      : '$guidesBaseUrl/en/imprint',
);

/// The privacy policy on hummlist.com (`site/content/legal/`), German or
/// English. Every privacy link in the app goes here.
Uri privacyPolicyUrl(String languageCode) => Uri.parse(
  languageCode == 'de'
      ? '$guidesBaseUrl/datenschutz'
      : '$guidesBaseUrl/en/privacy',
);

/// Whether the help and contact page is live on hummlist.com. Until Peter
/// approves its text it is a draft (`draft: true` in
/// `site/content/legal/support.md` and `support-en.md`), which production
/// builds of the site leave out. Publishing flips this and drops those
/// draft lines (docs/NEEDS_PETER.md, Job 24).
const supportPagePublished = false;

/// More shows "Hilfe & Kontakt" once the page is published, and before
/// that only where drafts are wanted ([Environment.legalDrafts]).
const supportLinkShown = supportPagePublished || Environment.legalDrafts;

/// The help and contact page on hummlist.com, German or English.
Uri supportUrl(String languageCode) => Uri.parse(
  languageCode == 'de' ? '$guidesBaseUrl/support' : '$guidesBaseUrl/en/support',
);
