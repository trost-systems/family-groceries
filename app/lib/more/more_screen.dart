import 'dart:async';

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/guides.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/feedback/feedback_sheet.dart';
import 'package:family_groceries/household/invite_dialog.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/categories_screen.dart';
import 'package:family_groceries/more/stores_screen.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/settings/access_screen.dart';
import 'package:family_groceries/settings/account_screen.dart';
import 'package:family_groceries/settings/settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// The pages More opens: beside its list on wide screens, on their own
/// on phones.
enum MorePage() {
  /// The MCP server, tokens and connected apps (`/more/access`).
  access,

  /// The signed-in email, export and account deletion (`/more/account`).
  account,

  /// The draft privacy page while none is published (`/more/privacy`).
  privacy,

  /// Theme and language (`/more/settings`).
  settings,

  /// The language list below [settings] (`/more/settings/language`).
  language,
}

/// The More tab: household, access, account, sign-out, settings and the
/// legal pages, then the app version.
class const MoreScreen({super.key, final MorePage? page})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final wide = MediaQuery.sizeOf(context).width >= wideLayout;
    if (wide) {
      final shown = page ?? MorePage.access;
      return Scaffold(
        // The pages sit below `/more`; beside the list there is nothing to
        // go back to.
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Text(l10n.tabMore),
        ),
        body: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(width: 360, child: _MoreList(selected: shown)),
            const VerticalDivider(width: 1),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                    child: Row(
                      spacing: 8,
                      children: [
                        // The language list sits below Einstellungen, also
                        // beside the list.
                        if (shown == MorePage.language)
                          BackButton(
                            onPressed: () => context.go(appSettingsPath),
                          ),
                        Text(
                          _title(l10n, shown),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                  ),
                  Expanded(child: _Page(shown)),
                ],
              ),
            ),
          ],
        ),
      );
    }
    if (page case final page?) {
      // Every page is a route below `/more`, so back (the app bar's or the
      // system's) pops to the list, also after a deep link.
      return Scaffold(
        appBar: AppBar(title: Text(_title(l10n, page))),
        body: _Page(page),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabMore)),
      body: const _MoreList(),
    );
  }

  static String _title(AppLocalizations l10n, MorePage page) => switch (page) {
    MorePage.access => l10n.accessTitle,
    MorePage.account => l10n.account,
    MorePage.privacy => l10n.privacy,
    MorePage.settings => l10n.settingsTitle,
    MorePage.language => l10n.language,
  };
}

class const _Page(final MorePage page) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => switch (page) {
    MorePage.access => const AccessScreen(),
    MorePage.account => const AccountScreen(),
    MorePage.privacy => const _PrivacyDraft(),
    MorePage.settings => const SettingsScreen(),
    MorePage.language => const LanguageScreen(),
  };
}

class const _MoreList({final MorePage? selected}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = context.watch<SessionCubit>().state;
    final household = session is InHousehold ? session.household : null;
    return ListView(
      key: const ValueKey('more-screen'),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        _Section(l10n.household),
        if (household != null) ...[
          _Row(
            key: const ValueKey('more-invite'),
            icon: Icons.person_add_outlined,
            label: l10n.inviteMember,
            detail: household.name,
            onTap: () => unawaited(showInviteDialog(context, household)),
          ),
        ],
        _Row(
          key: const ValueKey('more-join'),
          icon: Icons.group_add_outlined,
          label: l10n.joinOtherHousehold,
          onTap: () => unawaited(showJoinCodeDialog(context)),
        ),
        _Row(
          key: const ValueKey('more-categories'),
          icon: Icons.category_outlined,
          label: l10n.manageCategories,
          onTap: () => unawaited(openCategories(context)),
        ),
        _Row(
          key: const ValueKey('more-stores'),
          icon: Icons.storefront_outlined,
          label: l10n.storesTitle,
          detail: l10n.storesRowHint,
          onTap: () => unawaited(openStores(context)),
        ),
        _Section(l10n.accessTitle),
        _Row(
          key: const ValueKey('more-access'),
          icon: Icons.key_outlined,
          label: l10n.accessTitle,
          detail: l10n.accessRowHint,
          selected: selected == MorePage.access,
          onTap: () => context.go(accessPath),
        ),
        _Section(l10n.account),
        _Row(
          key: const ValueKey('menu-account'),
          icon: Icons.manage_accounts_outlined,
          label: l10n.account,
          detail: l10n.accountRowHint,
          selected: selected == MorePage.account,
          onTap: () => context.go(accountPath),
        ),
        _Row(
          key: const ValueKey('more-sign-out'),
          icon: Icons.logout,
          label: l10n.signOut,
          onTap: () => unawaited(context.read<SessionCubit>().signOut()),
        ),
        _Section(l10n.feedbackSection),
        _Row(
          key: const ValueKey('more-feedback'),
          icon: Icons.feedback_outlined,
          label: l10n.feedbackRow,
          detail: l10n.feedbackRowHint,
          onTap: () => unawaited(showFeedbackSheet(context)),
        ),
        _Section(l10n.settingsTitle),
        _Row(
          key: const ValueKey('more-settings'),
          icon: Icons.settings_outlined,
          label: l10n.settingsTitle,
          detail: l10n.settingsRowHint,
          selected:
              selected == MorePage.settings || selected == MorePage.language,
          onTap: () => context.go(appSettingsPath),
        ),
        if (context.read<Analytics>().enabled) ...[
          _Section(l10n.analyticsSection),
          const _AnalyticsSwitch(),
        ],
        _Section(l10n.legal),
        _Row(
          key: const ValueKey('more-imprint'),
          icon: Icons.info_outline,
          label: l10n.imprint,
          external: true,
          onTap: () => unawaited(
            launchUrl(imprintUrl(Localizations.localeOf(context).languageCode)),
          ),
        ),
        _Row(
          key: const ValueKey('more-privacy'),
          icon: Icons.privacy_tip_outlined,
          label: l10n.privacy,
          selected: selected == MorePage.privacy,
          onTap: () => switch (privacyPolicyUrl) {
            final url? => unawaited(launchUrl(Uri.parse(url))),
            null => context.go(privacyPath),
          },
        ),
        _Row(
          key: const ValueKey('more-licenses'),
          icon: Icons.description_outlined,
          label: l10n.licenses,
          onTap: () => unawaited(_showLicenses(context)),
        ),
        const _Version(),
      ],
    );
  }

  static Future<void> _showLicenses(BuildContext context) async {
    final info = await PackageInfo.fromPlatform();
    if (context.mounted) {
      showLicensePage(
        context: context,
        applicationName: AppLocalizations.of(context).appTitle,
        applicationVersion: _versionOf(info),
      );
    }
  }
}

String _versionOf(PackageInfo info) => info.buildNumber.isEmpty
    ? info.version
    : '${info.version} (${info.buildNumber})';

class const _Section(final String title) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Semantics(
        header: true,
        child: Text(
          title,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: scheme.primary,
          ),
        ),
      ),
    );
  }
}

class const _Row({
  required final IconData icon,
  required final String label,
  required final VoidCallback onTap,
  final String? detail,
  final bool selected = false,

  /// Opens a web page outside the app.
  final bool external = false,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ListTile(
    minTileHeight: 56,
    leading: Icon(icon),
    title: Text(label),
    subtitle: detail == null ? null : Text(detail!),
    trailing: Icon(external ? Icons.open_in_new : Icons.chevron_right),
    selected: selected,
    onTap: onTap,
  );
}

/// The analytics consent of this install (job 19): off stops sending at
/// once and drops what waits.
class const _AnalyticsSwitch() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final consent = context.select<Analytics, bool>(
      (a) => a.state.consent ?? false,
    );
    return SwitchListTile(
      key: const ValueKey('more-analytics'),
      title: Text(l10n.analyticsToggle),
      subtitle: Text('${l10n.analyticsToggleHint}\n${l10n.analyticsDraftNote}'),
      isThreeLine: true,
      value: consent,
      onChanged: (on) =>
          unawaited(context.read<Analytics>().decide(granted: on)),
    );
  }
}

/// The version; a long press marks this install internal (or not), so a
/// test phone's events are filtered out of the gate insights. An internal
/// install can raise a test error for error tracking.
class const _Version() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final internal = context.select<Analytics, bool>(
      (a) => a.state.internalInstall,
    );
    return Column(
      children: [
        GestureDetector(
          // The whole row, padding included, takes the long press.
          behavior: HitTestBehavior.opaque,
          onLongPress: () => unawaited(_toggleInternal(context, !internal)),
          child: FutureBuilder(
            future: PackageInfo.fromPlatform(),
            builder: (context, snapshot) => Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: Text(
                switch (snapshot.data) {
                  final info? => l10n.appVersion(_versionOf(info)),
                  null => '',
                },
                key: const ValueKey('more-version'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
        ),
        if (internal) ...[
          Text(
            l10n.internalInstall,
            key: const ValueKey('more-internal'),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          TextButton(
            key: const ValueKey('more-test-error'),
            onPressed: _raiseTestError,
            child: Text(l10n.sendTestError),
          ),
        ],
      ],
    );
  }

  static Future<void> _toggleInternal(BuildContext context, bool on) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    await context.read<Analytics>().markInternalInstall(internal: on);
    messenger.showSnackBar(
      SnackBar(
        content: Text(on ? l10n.internalInstallOn : l10n.internalInstallOff),
      ),
    );
  }

  /// Thrown outside any handler, so it takes the path a real crash takes.
  static void _raiseTestError() => Timer.run(
    () => throw StateError('Hummlist test error (More, internal install)'),
  );
}

/// No privacy policy is published yet. This page says so instead of
/// inventing legal text.
class const _PrivacyDraft() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      key: const ValueKey('privacy-draft'),
      padding: const EdgeInsets.all(24),
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Chip(
            label: Text(l10n.draft),
            backgroundColor: scheme.tertiaryContainer,
          ),
        ),
        const SizedBox(height: 16),
        Text(l10n.privacyDraftBody),
      ],
    );
  }
}
