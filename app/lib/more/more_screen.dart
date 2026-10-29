import 'dart:async';

import 'package:family_groceries/app/guides.dart';
import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/shell.dart';
import 'package:family_groceries/household/invite_dialog.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/categories_screen.dart';
import 'package:family_groceries/more/stores_screen.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:family_groceries/settings/settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// The pages More opens: beside its list on wide screens, on their own
/// on phones.
enum MorePage() {
  /// The MCP server, tokens and connected apps (`/settings`).
  access,

  /// The same page at export and account deletion
  /// (`/settings?section=account`).
  account,

  /// The draft privacy page while none is published (`/more/privacy`).
  privacy,
}

/// The More tab: household, access, account, language, sign-out and the
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
        appBar: AppBar(title: Text(l10n.tabMore)),
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
                    child: Text(
                      _title(l10n, shown),
                      style: Theme.of(context).textTheme.titleLarge,
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
      // `/settings` is not below `/more`, so there is nothing to pop: back
      // (the app bar's or the system's) goes to More instead of leaving.
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) {
            context.go(morePath);
          }
        },
        child: Scaffold(
          appBar: AppBar(
            leading: BackButton(onPressed: () => context.go(morePath)),
            title: Text(_title(l10n, page)),
          ),
          body: _Page(page),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabMore)),
      body: const _MoreList(),
    );
  }

  static String _title(AppLocalizations l10n, MorePage page) => switch (page) {
    MorePage.access || MorePage.account => l10n.accessTitle,
    MorePage.privacy => l10n.privacy,
  };
}

class const _Page(final MorePage page) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => switch (page) {
    // A new key re-scrolls when the wide layout switches between the two.
    MorePage.access || MorePage.account => SettingsScreen(
      key: ValueKey(page),
      showAccount: page == MorePage.account,
    ),
    MorePage.privacy => const _PrivacyDraft(),
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
          onTap: () => context.go(settingsPath),
        ),
        _Section(l10n.account),
        _Row(
          key: const ValueKey('menu-account'),
          icon: Icons.manage_accounts_outlined,
          label: l10n.account,
          detail: l10n.accountRowHint,
          selected: selected == MorePage.account,
          onTap: () => context.go('$settingsPath?section=account'),
        ),
        _Row(
          key: const ValueKey('more-sign-out'),
          icon: Icons.logout,
          label: l10n.signOut,
          onTap: () => unawaited(context.read<SessionCubit>().signOut()),
        ),
        _Section(l10n.language),
        const _LanguagePicker(),
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

/// System, Deutsch, English: applied at once and kept on the device.
class const _LanguagePicker() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final picked = context.watch<LanguageCubit>().state;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: SegmentedButton<AppLanguage?>(
        key: const ValueKey('more-language'),
        showSelectedIcon: false,
        style: const ButtonStyle(
          visualDensity: VisualDensity.standard,
          minimumSize: WidgetStatePropertyAll(Size(0, 44)),
        ),
        segments: [
          ButtonSegment(
            value: null,
            label: Text(
              l10n.languageSystem,
              key: const ValueKey('language-system'),
            ),
          ),
          ButtonSegment(
            value: AppLanguage.de,
            label: Text(
              l10n.languageGerman,
              key: const ValueKey('language-de'),
            ),
          ),
          ButtonSegment(
            value: AppLanguage.en,
            label: Text(
              l10n.languageEnglish,
              key: const ValueKey('language-en'),
            ),
          ),
        ],
        selected: {picked},
        onSelectionChanged: (choice) =>
            context.read<LanguageCubit>().pick(choice.single),
      ),
    );
  }
}

class const _Version() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FutureBuilder(
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
    );
  }
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
