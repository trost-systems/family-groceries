import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/session/social_sign_in.dart';
import 'package:family_groceries/settings/account_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class const App({
  required final SessionCubit session,
  required final SocialSignIn social,
  required final DeviceCache cache,
  required final AccountRepository account,
  required final Analytics analytics,

  /// The language picked under More, read before the first frame.
  final AppLanguage? language,
  super.key,
}) extends StatefulWidget {
  @override
  State<App> createState() => _AppState();
}

class _AppState() extends State<App> {
  late final GoRouter _router = buildRouter(widget.session, widget.analytics);
  late final _language = LanguageCubit(widget.cache, widget.language);

  /// Sends what analytics has queued when the app goes to the background
  /// or the tab is hidden: it may not come back.
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onHide: () => unawaited(widget.analytics.flush()),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _router.dispose();
    unawaited(_language.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF2E7D32);
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: widget.social),
        RepositoryProvider.value(value: widget.cache),
        RepositoryProvider.value(value: widget.account),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider.value(value: widget.session),
          BlocProvider.value(value: widget.analytics),
          BlocProvider.value(value: _language),
        ],
        child: BlocBuilder<LanguageCubit, AppLanguage?>(
          builder: (context, picked) => MaterialApp.router(
            onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
            theme: ThemeData(colorSchemeSeed: seed),
            darkTheme: ThemeData(
              colorSchemeSeed: seed,
              brightness: Brightness.dark,
            ),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: picked == null ? null : Locale(picked.code),
            localeListResolutionCallback: (preferred, _) =>
                resolveLocale(preferred, null),
            routerConfig: _router,
            builder: (context, child) => BlocBuilder<SessionCubit, Session>(
              builder: (context, session) => session is SessionLoading
                  ? const Scaffold(
                      body: Center(child: CircularProgressIndicator()),
                    )
                  : child!,
            ),
          ),
        ),
      ),
    );
  }
}
