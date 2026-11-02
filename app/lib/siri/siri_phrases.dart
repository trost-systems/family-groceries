/// The App Shortcut phrases of `app/ios/Runner/{en,de}.lproj/AppShortcuts.strings`
/// that the Zugänge page lists, in Siri's language rather than the app's: Siri
/// listens in the language set on the iPhone. scripts/siri-phrases.ts checks
/// that Siri knows each one.
const siriPhrases = (
  en: [
    'Add to Hummlist',
    'Add something to my Hummlist',
    'Add <item> to Hummlist',
    "What's on my Hummlist?",
  ],
  de: [
    'Füge etwas zur Hummlist hinzu',
    'Setz etwas auf meine Hummlist',
    'Füge <Eintrag> zur Hummlist hinzu',
    'Was steht auf meiner Hummlist?',
  ],
);
