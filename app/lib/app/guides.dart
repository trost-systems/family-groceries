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
