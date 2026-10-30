import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/analytics/setup.dart';
import 'package:family_groceries/app/app.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/app/language.dart';
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

Future<void> main() async {
  // Errors no one caught go to error tracking (job 19): those in this zone
  // here, the framework's through FlutterError.onError, the rest through
  // the platform dispatcher. Analytics sends nothing without consent.
  await runZonedGuarded(_main, (error, stack) {
    _analytics?.captureException(error, stack);
    Zone.root.print('Uncaught: $error\n$stack');
  });
}

Future<void> _main() async {
  // Path URLs (/join/CODE, later /oauth/consent) instead of #-fragments.
  usePathUrlStrategy();
  WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) {
    // Exposes the widget tree to the DOM for screen readers and Playwright.
    SemanticsBinding.instance.ensureSemantics();
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
  runApp(
    App(
      language: language,
      session: SessionCubit(client, cache, analytics: analytics),
      analytics: analytics,
      social: social,
      cache: cache,
      account: account,
    ),
  );
}
