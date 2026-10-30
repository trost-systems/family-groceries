import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/device_cache.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/feedback/feedback_context.dart';
import 'package:family_groceries/feedback/feedback_cubit.dart';
import 'package:family_groceries/feedback/feedback_repository.dart';
import 'package:family_groceries/feedback/screen_tracker.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/invite_share.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
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
  required final FeedbackRepository feedback,
  required final InviteRepository invites,

  /// Whether the household has Hummlist Lifetime.
  required final Entitlements entitlements,

  /// Hummlist Lifetime's purchase, listening to the store since start.
  required final PurchaseCubit purchases,

  /// The invite link waiting for an answer, loaded before the first frame.
  required final PendingInvite pendingInvite,

  /// The share sheet and clipboard; the plugins by default.
  final InviteSharer? sharer,

  /// Build and device facts for feedback; the plugins by default.
  final FeedbackDevice? feedbackDevice,

  /// The language picked under More's Einstellungen, read before the
  /// first frame.
  final AppLanguage? language,

  /// The theme picked there; the device's setting by default.
  final ThemeMode theme = ThemeMode.system,
  super.key,
}) extends StatefulWidget {
  @override
  State<App> createState() => _AppState();
}

class _AppState() extends State<App> {
  late final GoRouter _router = buildRouter(
    widget.session,
    widget.analytics,
    widget.pendingInvite,
  );
  late final InviteSharer _sharer = widget.sharer ?? PlatformInviteSharer();
  late final _language = LanguageCubit(widget.cache, widget.language);
  late final _theme = ThemeCubit(widget.cache, widget.theme);

  /// Built once: a theme change only switches between them.
  final _light = appTheme(Brightness.light);
  final _dark = appTheme(Brightness.dark);
  final _screens = ScreenTracker();
  late final _feedback = FeedbackCubit(
    widget.feedback,
    analytics: widget.analytics,
  );
  late final FeedbackDevice _device =
      widget.feedbackDevice ?? PluginFeedbackDevice();

  /// Sends what analytics has queued when the app goes to the background
  /// or the tab is hidden: it may not come back.
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onHide: () => unawaited(widget.analytics.flush()),
    );
    _router.routerDelegate.addListener(_onRoute);
    // The first location may be set before anyone listens (a reload on
    // `/more`): take it once the first frame is up.
    WidgetsBinding.instance.addPostFrameCallback((_) => _onRoute());
  }

  void _onRoute() {
    final configuration = _router.routerDelegate.currentConfiguration;
    if (configuration.isNotEmpty) {
      _screens.visit(configuration.uri);
    }
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _router.routerDelegate.removeListener(_onRoute);
    _router.dispose();
    unawaited(_language.close());
    unawaited(_feedback.close());
    unawaited(_theme.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MultiRepositoryProvider(
    providers: [
      RepositoryProvider.value(value: widget.social),
      RepositoryProvider.value(value: widget.cache),
      RepositoryProvider.value(value: widget.account),
      RepositoryProvider.value(value: _screens),
      RepositoryProvider.value(value: _device),
      RepositoryProvider.value(value: widget.invites),
      RepositoryProvider.value(value: widget.pendingInvite),
      RepositoryProvider.value(value: _sharer),
    ],
    child: MultiBlocProvider(
      providers: [
        BlocProvider.value(value: widget.session),
        BlocProvider.value(value: widget.entitlements),
        BlocProvider.value(value: widget.purchases),
        BlocProvider.value(value: widget.analytics),
        BlocProvider.value(value: _language),
        BlocProvider.value(value: _feedback),
        BlocProvider.value(value: _theme),
      ],
      child: Builder(
        builder: (context) => MaterialApp.router(
          onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
          theme: _light,
          darkTheme: _dark,
          themeMode: context.watch<ThemeCubit>().state,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: switch (context.watch<LanguageCubit>().state) {
            final picked? => Locale(picked.code),
            null => null,
          },
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
