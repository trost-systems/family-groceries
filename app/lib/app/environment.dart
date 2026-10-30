/// Build-time configuration. The only file that reads `--dart-define`s.
/// Defaults point at the production project; its URL and publishable key
/// are public by design.
abstract final class Environment() {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: _productionUrl,
  );
  static const _productionUrl = 'https://jdwqrallbpdbshrdhenk.supabase.co';
  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: 'sb_publishable_YMFUFoZ-smly3zDIYTIFRw_vRt6UBk5',
  );

  /// Public web origin for invite links from the mobile apps; empty shows
  /// only the code. Production builds take it from `config/auth.json`.
  static const appUrl = String.fromEnvironment('APP_URL');

  /// Google OAuth "Web application" client ID. Supabase verifies ID tokens
  /// against it and native sign-in passes it as the server client ID; empty
  /// hides the Google button.
  static const googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
  );

  /// Google OAuth "iOS" client ID; empty hides the Google button on iOS.
  static const googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
  );

  /// Whether the Supabase project has Sign in with Apple configured.
  static const signInWithApple = bool.fromEnvironment('SIGN_IN_WITH_APPLE');

  /// PostHog project API key (`phc_…`, Einkauf project 319492). Empty, the
  /// default and what CI builds get, turns analytics and error tracking off
  /// completely (docs/ANALYTICS.md). Never committed: Vercel and release
  /// builds pass it in.
  static const posthogProjectKey = String.fromEnvironment(
    'POSTHOG_PROJECT_API_KEY',
  );

  /// PostHog ingestion host; only https://eu.i.posthog.com (or a stand-in
  /// that can't reach PostHog, for e2e) is accepted. No default.
  static const posthogHost = String.fromEnvironment('POSTHOG_HOST');

  /// Household ids whose events are internal (Peter's family),
  /// comma-separated.
  static const analyticsInternalHouseholds = String.fromEnvironment(
    'ANALYTICS_INTERNAL_HOUSEHOLDS',
  );

  /// E-mail domains whose users are internal besides the reserved test
  /// domains, comma-separated.
  static const analyticsInternalEmailDomains = String.fromEnvironment(
    'ANALYTICS_INTERNAL_EMAIL_DOMAINS',
  );

  /// Every event of this build is internal (Vercel's preview deployments).
  static const analyticsInternalBuild = bool.fromEnvironment(
    'ANALYTICS_INTERNAL_BUILD',
  );

  /// Also sends the PostHog `household` group. Off: group analytics is a
  /// paid add-on (NEEDS_PETER).
  static const analyticsHouseholdGroups = bool.fromEnvironment(
    'ANALYTICS_HOUSEHOLD_GROUPS',
  );

  /// The MCP server endpoint:for the production project its public URL,
  /// a Vercel proxy to the edge function (docs/MCP.md); for any other
  /// project (the local stack) the edge function itself.
  static const mcpUrl = supabaseUrl == _productionUrl
      ? 'https://mcp.hummlist.com'
      : '$supabaseUrl/functions/v1/mcp';
}

/// Where this web app lives; it is always served at the domain root.
String get webRoot => Uri.base.origin;
