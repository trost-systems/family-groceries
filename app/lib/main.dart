import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/setup.dart';
import 'package:family_groceries/app/app.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/early_keys.dart';
import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/feedback/feedback_repository.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_api.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/setup.dart';
import 'package:family_groceries/session/plugin_sign_in.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/session/social_sign_in.dart';
import 'package:family_groceries/settings/account_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Set once analytics is loaded; errors before that are not reported.
Analytics? _analytics;

Future<void> main() => bootstrap(WidgetsFlutterBinding.ensureInitialized);

/// Starts the app with [binding], which `test_driver/main_marionette.dart`
/// swaps for its own. The binding is initialized in the same zone as
/// `runApp`; Flutter asserts that ("Zone mismatch").
Future<void> bootstrap(WidgetsBinding Function() binding) async {
  // Errors no one caught go to error tracking (job 19): those in this zone
  // here, the framework's through FlutterError.onError, the rest through
  // the platform dispatcher. Analytics sends nothing without consent.
  await runZonedGuarded(() => _main(binding), (error, stack) {
    _analytics?.captureException(error, stack);
    Zone.root.print('Uncaught: $error\n$stack');
  });
}

Future<void> _main(WidgetsBinding Function() binding) async {
  // Path URLs (/join/CODE, later /oauth/consent) instead of #-fragments.
  usePathUrlStrategy();
  binding();
  if (kIsWeb) {
    // Exposes the widget tree to the DOM for screen readers and Playwright.
    SemanticsBinding.instance.ensureSemantics();
    // Semantics hands a field's input to the app a frame late.
    EarlyKeys();
  }
  await Supabase.initialize(
    url: Environment.supabaseUrl,
    publishableKey: Environment.supabasePublishableKey,
    // The list and session retry on their own (every 3 s, ops until acked);
    // postgrest's GET retries (1 + 2 + 4 s) only hid an offline start.
    // `client.from` ignores this option, so reads go through `client.rest`.
    postgrestOptions: const PostgrestClientOptions(retryEnabled: false),
  );
  final client = Supabase.instance.client;
  final social = SocialSignIn(
    client.auth,
    flows: socialFlows(
      (
        googleWebClientId: Environment.googleWebClientId,
        googleIosClientId: Environment.googleIosClientId,
        apple: Environment.signInWithApple,
      ),
      web: kIsWeb,
      platform: defaultTargetPlatform,
    ),
    native: PluginSignIn(
      googleWebClientId: Environment.googleWebClientId,
      googleIosClientId: defaultTargetPlatform == TargetPlatform.iOS
          ? Environment.googleIosClientId
          : null,
    ),
  );
  final cache = DeviceCache.onDevice();
  final analytics = _analytics = await startAnalytics(cache);
  final presentError = FlutterError.onError;
  FlutterError.onError = (details) {
    presentError?.call(details);
    analytics.captureException(details.exception, details.stack);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    analytics.captureException(error, stack);
    return false;
  };
  final account = SupabaseAccountRepository(
    client,
    // Only iOS has Apple's own dialog; elsewhere the server answers
    // `manual` and the user unlinks the app on their iPhone.
    appleCode: !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS
        ? appleAuthorizationCode
        : null,
  );
  final language = AppLanguage.byCode(await cache.language());
  final theme = themeModeOf(await cache.theme());
  final pendingInvite = await PendingInvite.load(cache);
  final session = SessionCubit(
    client,
    cache,
    analytics: analytics,
    pendingInvite: pendingInvite,
  );
  final entitlements = Entitlements(
    SupabaseEntitlementsSource(client),
    session,
  );
  // Offline the last answer stands; it names its household, so it never
  // marks another one.
  entitlements.stream.listen((state) {
    if (state case EntitlementsKnown(:final householdId, :final unlocks)) {
      analytics.testerHousehold = unlocks.tester ? householdId : null;
    }
  });
  runApp(
    App(
      language: language,
      theme: theme,
      session: session,
      entitlements: entitlements,
      // Asks no store until the Lifetime page needs it.
      purchases: PurchaseCubit(
        purchaseRepository(client),
        SupabaseClaimApi(client),
        entitlements,
        session,
      ),
      analytics: analytics,
      social: social,
      cache: cache,
      account: account,
      feedback: SupabaseFeedbackRepository(client),
      invites: SupabaseInviteRepository(client),
      pendingInvite: pendingInvite,
    ),
  );
}
