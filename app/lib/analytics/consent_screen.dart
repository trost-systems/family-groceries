import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Asked once per install, right after the first sign-in and before
/// onboarding or the list: may Hummlist send usage data and error reports?
/// Both answers are one tap and equally prominent; the router moves on as
/// soon as one is stored. The wording is a draft until Peter approves it.
class const AnalyticsConsentScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      // A title, like every other page: screen readers (and the web engine's
      // focus on a new page) start on it, not on the sign-out button.
      appBar: AppBar(
        title: Text(l10n.analyticsSection),
        actions: [
          IconButton(
            tooltip: l10n.signOut,
            icon: const Icon(Icons.logout),
            onPressed: () => unawaited(context.read<SessionCubit>().signOut()),
          ),
        ],
      ),
      // One list like the welcome screen's. A layout with the answers pinned
      // below a scrolling text made the web engine move the list's add field
      // in the page after this one and lose its focus (DECISIONS 19.20).
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: ListView(
            key: const ValueKey('analytics-consent'),
            padding: const EdgeInsets.all(24),
            shrinkWrap: true,
            children: [
              Icon(
                Icons.insights_outlined,
                size: 48,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                l10n.analyticsConsentTitle,
                style: theme.textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(l10n.analyticsConsentBody),
              const SizedBox(height: 12),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Chip(
                  label: Text(l10n.analyticsDraftNote),
                  backgroundColor: theme.colorScheme.tertiaryContainer,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      key: const ValueKey('analytics-consent-decline'),
                      onPressed: () => unawaited(
                        context.read<Analytics>().decide(granted: false),
                      ),
                      child: Text(l10n.analyticsDecline),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.tonal(
                      key: const ValueKey('analytics-consent-accept'),
                      onPressed: () => unawaited(
                        context.read<Analytics>().decide(granted: true),
                      ),
                      child: Text(l10n.analyticsAccept),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
