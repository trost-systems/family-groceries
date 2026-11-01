import 'dart:async';

import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/oauth/consent_screen.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/settings/access_cubit.dart';
import 'package:family_groceries/settings/access_repository.dart';
import 'package:family_groceries/settings/integration_lock.dart';
import 'package:family_groceries/siri/siri_channel.dart';
import 'package:family_groceries/siri/siri_phrases.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Ways in from outside the app: the MCP endpoint, Siri, personal access
/// tokens and OAuth-connected apps (`/more/access`). A page of the More
/// tab, which gives it its frame.
class const AccessScreen({
  super.key,

  /// Overrides the Supabase repository, for tests.
  final AccessRepository? repository,

  /// Overrides the platform's Siri channel (iOS only), for tests.
  final SiriChannel? siri,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final siri =
        this.siri ??
        siriChannelFor(web: kIsWeb, platform: defaultTargetPlatform);
    return BlocProvider(
      create: (_) {
        final cubit = AccessCubit(
          repository ?? SupabaseAccessRepository(Supabase.instance.client),
          siri: siri,
        );
        unawaited(cubit.load());
        // Job 50: the server's lock switches, read again on every visit.
        unawaited(context.read<IntegrationLockCubit?>()?.refresh());
        return cubit;
      },
      child: _Access(onIphone: siri != null),
    );
  }
}

/// A user-made token named like the old Shortcut recipe's (`Siri` in
/// docs/SIRI_SHORTCUT.md), which native Siri replaces.
bool _isShortcutToken(AccessToken token) =>
    token.kind == AccessKind.pat &&
    RegExp(
      'siri|kurzbefehl|shortcut',
      caseSensitive: false,
    ).hasMatch(token.name);

class const _Access({required final bool onIphone}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = context.watch<AccessCubit>().state;
    final tokens = switch (state.tokens) {
      SectionLoaded(:final value) => value,
      _ => const <AccessToken>[],
    };
    final siriTokens = [
      for (final t in tokens)
        if (t.kind == AccessKind.siri) t,
    ];
    final shortcutTokens = tokens.where(_isShortcutToken).toList();
    final access = _accessOf(context);
    final paused = access is IntegrationsLocked;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: ListView(
          key: const ValueKey('access-screen'),
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            if (access case IntegrationsLocked(:final offer))
              _PremiumCard(offer: offer),
            _Header(l10n.mcpServer),
            ListTile(
              title: const SelectionArea(child: Text(Environment.mcpUrl)),
              subtitle: Text(l10n.mcpServerBody),
              trailing: IconButton(
                tooltip: l10n.copy,
                icon: const Icon(Icons.copy),
                onPressed: () => _copy(context, Environment.mcpUrl),
              ),
            ),
            if (onIphone || siriTokens.isNotEmpty) _Header(l10n.siriHeader),
            if (onIphone) _SiriCard(shortcutTokens: shortcutTokens),
            for (final token in siriTokens)
              _TokenTile(
                token: token,
                label: token.id == state.siriHere
                    ? l10n.siriThisIphone
                    : l10n.siriOtherIphone,
                paused: paused,
              ),
            _Header(l10n.accessTokens),
            ..._section(
              context,
              switch (state.tokens) {
                SectionLoaded(:final value) => SectionLoaded([
                  for (final t in value)
                    if (t.kind == AccessKind.pat) t,
                ]),
                final other => other,
              },
              empty: l10n.noTokens,
              tile: (token) =>
                  _TokenTile(token: token, label: token.name, paused: paused),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.tonalIcon(
                  icon: const Icon(Icons.add),
                  label: Text(l10n.createToken),
                  onPressed: () => unawaited(_createToken(context)),
                ),
              ),
            ),
            _Header(l10n.connectedApps),
            ..._section(
              context,
              state.apps,
              empty: l10n.noConnectedApps,
              tile: (app) => _AppTile(app: app, paused: paused),
            ),
          ],
        ),
      ),
    );
  }

  /// Job 50: whether to show the lock. Without the app-wide cubit (a
  /// screen on its own) or with the `INTEGRATION_LOCK` define off, never.
  static IntegrationAccess _accessOf(BuildContext context) {
    final server = context.watch<IntegrationLockCubit?>()?.state;
    if (server == null) {
      return const IntegrationsOpen();
    }
    return integrationAccess(
      server: server,
      // Watched: a purchase by any member arrives over Realtime and hides
      // the card within one sync.
      entitlements: context.watch<Entitlements>(),
      noSale: context.read<PurchaseCubit>().state.noSale,
    );
  }

  static List<Widget> _section<T>(
    BuildContext context,
    Section<List<T>> section, {
    required String empty,
    required Widget Function(T value) tile,
  }) => switch (section) {
    SectionLoading() => const [
      Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ),
    ],
    SectionFailed(:final message) => [
      ListTile(title: Text(AppLocalizations.of(context).genericError(message))),
    ],
    SectionLoaded(value: []) => [ListTile(title: Text(empty))],
    SectionLoaded(:final value) => [for (final v in value) tile(v)],
  };
}

void _copy(BuildContext context, String text) {
  unawaited(Clipboard.setData(ClipboardData(text: text)));
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).copied)));
}

String _errorText(AppLocalizations l10n, Object error) => switch (error) {
  AccessError(code: 'too_many_tokens') => l10n.tooManyTokens,
  AccessError(:final code) => l10n.genericError(code),
  _ => l10n.genericError('$error'),
};

Future<bool> _confirm(
  BuildContext context, {
  required String title,
  required String body,
  required String action,
}) async {
  final l10n = AppLocalizations.of(context);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialog).pop(false),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialog).pop(true),
          child: Text(action),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}

/// Runs [action], showing a failure as a snack bar.
Future<void> _attempt(
  BuildContext context,
  Future<void> Function() action,
) async {
  final l10n = AppLocalizations.of(context);
  final messenger = ScaffoldMessenger.of(context);
  try {
    await action();
  } on Object catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(_errorText(l10n, e))));
  }
}

Future<void> _createToken(BuildContext context) async {
  final cubit = context.read<AccessCubit>();
  final name = await showDialog<String>(
    context: context,
    builder: (_) => const _NameDialog(),
  );
  if (name == null || !context.mounted) {
    return;
  }
  await _attempt(context, () async {
    final token = await cubit.create(name);
    if (context.mounted) {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _NewTokenDialog(token: token),
      );
    }
  });
}

class const _Header(final String text) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
    child: Semantics(
      header: true,
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleMedium
            ?.copyWith(color: Theme.of(context).colorScheme.primary),
      ),
    ),
  );
}

class const _SiriCard({required final List<AccessToken> shortcutTokens})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Card(
      key: const ValueKey('siri-card'),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.siriWorksWithoutSetup),
            for (final token in shortcutTokens)
              Padding(
                key: const ValueKey('siri-legacy-hint'),
                padding: const EdgeInsets.only(top: 8),
                child: Text(l10n.siriOldShortcutHint(token.name)),
              ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                key: const ValueKey('siri-phrases'),
                onPressed: () => unawaited(
                  showDialog<void>(
                    context: context,
                    builder: (_) => const _SiriPhrasesDialog(),
                  ),
                ),
                child: Text(l10n.siriShowPhrases),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Both languages: Siri listens in the iPhone's, not the app's.
class const _SiriPhrasesDialog() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final english = (l10n.siriPhrasesEnglish, siriPhrases.en);
    final german = (l10n.siriPhrasesGerman, siriPhrases.de);
    final languages = l10n.localeName == 'en'
        ? [english, german]
        : [german, english];
    return AlertDialog(
      title: Text(l10n.siriPhrasesTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final (language, phrases) in languages) ...[
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 4),
                child: Text(
                  language,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
              for (final phrase in phrases) Text(l10n.siriPhrase(phrase)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.close),
        ),
      ],
    );
  }
}

class const _TokenTile({
  required final AccessToken token,

  /// The token's name, or what a Siri credential is called.
  required final String label,

  /// The household is locked (job 50): the token stays, unused for now.
  final bool paused = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final lastUsed = token.lastUsedAt;
    final siri = token.kind == AccessKind.siri;
    return ListTile(
      leading: Icon(siri ? Icons.mic_none : Icons.key),
      title: Text(label),
      subtitle: _Subtitle(
        [
          l10n.tokenHint(token.hint),
          l10n.createdOn(token.createdAt),
          if (lastUsed == null) l10n.neverUsed else l10n.lastUsedOn(lastUsed),
        ].join(' · '),
        paused: paused,
      ),
      trailing: IconButton(
        tooltip: l10n.revokeToken(label),
        icon: const Icon(Icons.delete_outline),
        onPressed: () => unawaited(_revoke(context)),
      ),
    );
  }

  Future<void> _revoke(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<AccessCubit>();
    final siri = token.kind == AccessKind.siri;
    final confirmed = await _confirm(
      context,
      title: siri ? l10n.revokeSiriTitle : l10n.revokeTokenTitle,
      body: siri ? l10n.revokeSiriBody : l10n.revokeTokenBody,
      action: l10n.revoke,
    );
    if (confirmed && context.mounted) {
      await _attempt(context, () => cubit.revoke(token.id));
    }
  }
}

class const _AppTile({
  required final ConnectedApp app,
  final bool paused = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListTile(
      leading: const Icon(Icons.smart_toy_outlined),
      title: Text(app.name),
      subtitle: _Subtitle(
        [
          l10n.connectedOn(app.grantedAt),
          for (final scope in app.scopes) scopeLabel(l10n, scope),
        ].join(' · '),
        paused: paused,
      ),
      trailing: IconButton(
        tooltip: l10n.disconnectApp(app.name),
        icon: const Icon(Icons.link_off),
        onPressed: () => unawaited(_disconnect(context)),
      ),
    );
  }

  Future<void> _disconnect(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<AccessCubit>();
    final confirmed = await _confirm(
      context,
      title: l10n.disconnectTitle(app.name),
      body: l10n.disconnectBody,
      action: l10n.disconnect,
    );
    if (confirmed && context.mounted) {
      await _attempt(context, () => cubit.disconnect(app.clientId));
    }
  }
}

/// A connection's details, below them "paused" while the household is
/// locked (job 50).
class const _Subtitle(final String details, {required final bool paused})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    if (!paused) {
      return Text(details);
    }
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(details),
        Text(
          AppLocalizations.of(context).integrationPaused,
          key: const ValueKey('access-paused'),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/// Job 50: Siri, Alexa and AI assistants are part of Hummlist Premium, for a
/// household known to have none while the server enforces the lock. Nothing
/// is removed; [offer] says how to unlock it.
class const _PremiumCard({required final LockOffer offer})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      key: const ValueKey('integration-premium'),
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              // Its own node: without it the header flag merges into the
              // card and makes all of it one heading.
              container: true,
              header: true,
              child: Text(
                l10n.integrationPremiumTitle,
                style: theme.textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 8),
            Text(l10n.integrationPremiumBody),
            const SizedBox(height: 8),
            for (final (icon, included) in [
              (Icons.mic_none, l10n.integrationPremiumSiri),
              (Icons.speaker_outlined, l10n.integrationPremiumAlexa),
              (Icons.smart_toy_outlined, l10n.integrationPremiumAi),
            ])
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Icon(icon, size: 20, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                    Expanded(child: Text(included)),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                l10n.integrationPremiumLater,
                style: theme.textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: 12),
            switch (offer) {
              LockOffer.buy => FilledButton(
                key: const ValueKey('integration-buy'),
                onPressed: () => context.go(
                  Uri(
                    path: premiumPath,
                    queryParameters: {'from': 'integrations'},
                  ).toString(),
                ),
                child: Text(l10n.integrationPremiumBuy),
              ),
              LockOffer.soon => Text(
                l10n.integrationPremiumSoon,
                key: const ValueKey('integration-soon'),
                style: theme.textTheme.titleSmall,
              ),
              LockOffer.inTheApps => Text(
                l10n.premiumWeb,
                key: const ValueKey('integration-in-the-apps'),
              ),
            },
          ],
        ),
      ),
    );
  }
}

class const _NameDialog() extends StatefulWidget {
  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState() extends State<_NameDialog> {
  final _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _submit() => Navigator.of(context).pop(_name.text.trim());

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.createToken),
      content: TextField(
        controller: _name,
        autofocus: true,
        maxLength: 60,
        decoration: InputDecoration(
          labelText: l10n.tokenName,
          hintText: l10n.tokenNameHint,
        ),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.cancel),
        ),
        FilledButton(onPressed: _submit, child: Text(l10n.create)),
      ],
    );
  }
}

/// The only time the secret is shown.
class const _NewTokenDialog({required final NewToken token})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.tokenCreated),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.tokenShownOnce),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: SelectionArea(
                  child: Text(
                    token.token,
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                ),
              ),
              IconButton(
                tooltip: l10n.copy,
                icon: const Icon(Icons.copy),
                onPressed: () => _copy(context, token.token),
              ),
            ],
          ),
        ],
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.done),
        ),
      ],
    );
  }
}
