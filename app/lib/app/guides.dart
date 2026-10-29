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

/// The published privacy policy. None exists yet, so More shows a draft
/// page instead (docs/NEEDS_PETER.md, Job 17); set this to link it.
const String? privacyPolicyUrl = null;
