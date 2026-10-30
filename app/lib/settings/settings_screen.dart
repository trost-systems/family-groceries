import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/app/theme.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

/// More's Einstellungen (`/more/settings`): the theme, light, dark or the
/// device's, and the language, a row that opens [LanguageScreen]. Both are
/// kept on the device and apply at once.
class const SettingsScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final mode = context.watch<ThemeCubit>().state;
    return ListView(
      key: const ValueKey('settings-screen'),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        _Section(l10n.appearance),
        RadioGroup<ThemeMode>(
          groupValue: mode,
          onChanged: (mode) => context.read<ThemeCubit>().pick(mode!),
          child: Column(
            children: [
              for (final (mode, icon, label) in [
                (
                  ThemeMode.system,
                  Icons.brightness_auto_outlined,
                  l10n.themeSystem,
                ),
                (ThemeMode.light, Icons.light_mode_outlined, l10n.themeLight),
                (ThemeMode.dark, Icons.dark_mode_outlined, l10n.themeDark),
              ])
                RadioListTile(
                  key: ValueKey('theme-${mode.name}'),
                  value: mode,
                  title: Text(label),
                  secondary: Icon(icon),
                ),
            ],
          ),
        ),
        _Section(l10n.language),
        ListTile(
          key: const ValueKey('settings-language'),
          minTileHeight: 56,
          leading: const Icon(Icons.language),
          title: Text(l10n.language),
          subtitle: Text(switch (context.watch<LanguageCubit>().state) {
            final picked? => picked.nativeName,
            null => l10n.languageSystemPicked(
              deviceLanguage(context).nativeName,
            ),
          }),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.go(languagePath),
        ),
      ],
    );
  }
}

/// The language list (`/more/settings/language`): the device's language
/// first, then every language the app speaks, each in its own name. A list
/// page rather than a dropdown or segments: it takes any number of
/// languages, shows the pick and what the device gives at a glance, and
/// reads well to a screen reader (DECISIONS 29e).
class const LanguageScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RadioGroup<AppLanguage?>(
      groupValue: context.watch<LanguageCubit>().state,
      onChanged: (language) => context.read<LanguageCubit>().pick(language),
      child: ListView(
        key: const ValueKey('language-screen'),
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          RadioListTile<AppLanguage?>(
            key: const ValueKey('language-system'),
            value: null,
            title: Text(l10n.languageSystem),
            subtitle: Text(
              l10n.languageSystemNow(deviceLanguage(context).nativeName),
            ),
          ),
          const Divider(indent: 16, endIndent: 16),
          for (final language in AppLanguage.values)
            RadioListTile<AppLanguage?>(
              key: ValueKey('language-${language.code}'),
              value: language,
              title: Text(language.nativeName),
            ),
        ],
      ),
    );
  }
}

/// The language the app speaks when it follows the device.
AppLanguage deviceLanguage(BuildContext context) => AppLanguage.byCode(
  resolveLocale(View.of(context).platformDispatcher.locales, null).languageCode,
)!;

class const _Section(final String title) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
    child: Semantics(
      header: true,
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    ),
  );
}
