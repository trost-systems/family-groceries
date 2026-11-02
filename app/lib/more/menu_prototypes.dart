part of 'more_screen.dart';

// Job 79: five prototypes of More (M-P1 to M-P5), reachable only in debug
// builds through the app bar's switcher. Each one is data: its sections of
// rows and its look, drawn by one renderer. Stores and categories are left
// out (job 78 moves them to the list's "Anpassen"); the usage-data switch
// sits on the Privacy page; the update card is the only card.

/// What the update card offers: a downloaded patch or a newer store
/// version.
enum UpdateOffer() {
  patch,
  store,
}

/// One prototype of More.
enum MenuPrototype() {
  p1,
  p2,
  p3,
  p4,
  p5;

  String title(AppLocalizations l10n) => switch (this) {
    p1 => l10n.menuProtoP1,
    p2 => l10n.menuProtoP2,
    p3 => l10n.menuProtoP3,
    p4 => l10n.menuProtoP4,
    p5 => l10n.menuProtoP5,
  };

  /// The card each prototype shows in its update state.
  UpdateOffer get offer => switch (this) {
    p1 || p3 || p5 => UpdateOffer.patch,
    p2 || p4 => UpdateOffer.store,
  };

  _Menu get _menu => switch (this) {
    p1 => _p1,
    p2 => _p2,
    p3 => _p3,
    p4 => _p4,
    p5 => _p5,
  };
}

/// The prototype More shows instead of today's list, and whether its update
/// card is up.
typedef MenuPreview = ({MenuPrototype prototype, bool updateCard});

/// Set by the debug switcher (and the screenshot tests); null is today's
/// menu.
final menuPreview = ValueNotifier<MenuPreview?>(null);

/// The switcher in More's app bar; on in debug builds only.
var showMenuPrototypeSwitch = kDebugMode;

enum _Item() {
  invite,
  join,
  archived,
  premium,
  access,
  account,
  privacy,
  signOut,
  settings,
  feedback,
  help,
  legal,
  imprint,
  privacyPolicy,
  licenses,
}

enum _Headers() {
  none,

  /// The list's small capitals with a rule ([HlSectionLabel]).
  label,

  /// Bricolage titles.
  title,
}

enum _Icons() {
  none,
  plain,

  /// The glyph on a tinted pointy hex.
  hex,
}

final class const _Look({
  required final double rowHeight,
  required final double sectionGap,
  required final _Headers headers,
  required final _Icons icons,
  final bool grouped = false,
  final bool hints = true,

  /// Settings show the theme and language at the row's end.
  final bool values = false,

  /// Sign out sits alone at the end in the error colour.
  final bool signOutApart = false,
});

final class const _Section(
  final String Function(AppLocalizations)? header,
  final List<_Item> items, {

  /// Smaller, muted rows (the footer's legal links).
  final bool quiet = false,
});

final class const _Menu(final _Look look, final List<_Section> sections);

String _household(AppLocalizations l) => l.household;
String _account(AppLocalizations l) => l.account;
String _legal(AppLocalizations l) => l.legal;

/// Today's order, cleaned: household, connections, account, help, about.
const _p1 = _Menu(
  _Look(
    rowHeight: 56,
    sectionGap: 20,
    headers: _Headers.label,
    icons: _Icons.plain,
  ),
  [
    _Section(_household, [
      _Item.invite,
      _Item.join,
      _Item.archived,
      _Item.premium,
    ]),
    _Section(_connections, [_Item.access]),
    _Section(_account, [
      _Item.account,
      _Item.privacy,
      _Item.settings,
      _Item.signOut,
    ]),
    _Section(_help, [_Item.feedback, _Item.help]),
    _Section(_about, [_Item.imprint, _Item.privacyPolicy, _Item.licenses]),
  ],
);

/// Inset groups without headers, hex icons, account first, sign out apart.
const _p2 = _Menu(
  _Look(
    rowHeight: 52,
    sectionGap: 24,
    headers: _Headers.none,
    icons: _Icons.hex,
    grouped: true,
    hints: false,
    signOutApart: true,
  ),
  [
    _Section(null, [_Item.account, _Item.premium]),
    _Section(null, [_Item.invite, _Item.join, _Item.archived]),
    _Section(null, [_Item.access]),
    _Section(null, [_Item.settings, _Item.privacy]),
    _Section(null, [_Item.feedback, _Item.help, _Item.legal]),
    _Section(null, [_Item.signOut]),
  ],
);

/// Much more room between sections, title headers, hints on every row.
const _p3 = _Menu(
  _Look(
    rowHeight: 64,
    sectionGap: HlSpace.s7,
    headers: _Headers.title,
    icons: _Icons.plain,
  ),
  [
    _Section(_household, [
      _Item.invite,
      _Item.join,
      _Item.archived,
      _Item.premium,
    ]),
    _Section(_connections, [_Item.access]),
    _Section(_app, [_Item.settings, _Item.privacy]),
    _Section(_help, [_Item.feedback, _Item.help]),
    _Section(_account, [_Item.account, _Item.signOut]),
    _Section(_about, [_Item.legal]),
  ],
);

/// Dense, text only, values at the end, three sections.
const _p4 = _Menu(
  _Look(
    rowHeight: 48,
    sectionGap: 12,
    headers: _Headers.label,
    icons: _Icons.none,
    hints: false,
    values: true,
    signOutApart: true,
  ),
  [
    _Section(_household, [
      _Item.invite,
      _Item.join,
      _Item.archived,
      _Item.premium,
    ]),
    _Section(_accountAccess, [_Item.account, _Item.access, _Item.privacy]),
    _Section(_appHelp, [
      _Item.settings,
      _Item.feedback,
      _Item.help,
      _Item.legal,
    ]),
    _Section(null, [_Item.signOut]),
  ],
);

/// Headers say what you want to do; legal links as a quiet footer.
const _p5 = _Menu(
  _Look(
    rowHeight: 60,
    sectionGap: HlSpace.s5,
    headers: _Headers.title,
    icons: _Icons.hex,
  ),
  [
    _Section(_share, [_Item.invite, _Item.join, _Item.archived]),
    _Section(_connect, [_Item.access, _Item.premium]),
    _Section(_taskHelp, [_Item.feedback, _Item.help]),
    _Section(_you, [
      _Item.account,
      _Item.settings,
      _Item.privacy,
      _Item.signOut,
    ]),
    _Section(_legal, [
      _Item.imprint,
      _Item.privacyPolicy,
      _Item.licenses,
    ], quiet: true),
  ],
);

String _connections(AppLocalizations l) => l.menuSecConnections;
String _help(AppLocalizations l) => l.menuSecHelp;
String _about(AppLocalizations l) => l.menuSecAbout;
String _app(AppLocalizations l) => l.menuSecApp;
String _accountAccess(AppLocalizations l) => l.menuSecAccountAccess;
String _appHelp(AppLocalizations l) => l.menuSecAppHelp;
String _share(AppLocalizations l) => l.menuTaskShare;
String _connect(AppLocalizations l) => l.menuTaskConnect;
String _taskHelp(AppLocalizations l) => l.menuTaskHelp;
String _you(AppLocalizations l) => l.menuTaskYou;

/// Today's list, or the prototype the debug switcher picked.
class const _MoreMenu({
  required final bool showHelp,
  required final bool showArchived,
  final MorePage? selected,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => ValueListenableBuilder(
    valueListenable: menuPreview,
    builder: (context, preview, _) => switch (preview) {
      final preview? => _PrototypeMenu(
        preview: preview,
        showHelp: showHelp,
        showArchived: showArchived,
      ),
      null => _MoreList(
        showHelp: showHelp,
        showArchived: showArchived,
        selected: selected,
      ),
    },
  );
}

/// More as the prototype draws it.
class const _PrototypeMenu({
  required final MenuPreview preview,
  required final bool showHelp,
  required final bool showArchived,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final menu = preview.prototype._menu;
    final look = menu.look;
    final l10n = AppLocalizations.of(context);
    final household = switch (context.watch<SessionCubit>().state) {
      InHousehold(:final household) => household,
      _ => null,
    };
    bool shown(_Item item) => switch (item) {
      _Item.invite => household != null,
      _Item.archived => showArchived,
      _Item.help => showHelp,
      _ => true,
    };
    final sections = [
      for (final s in menu.sections)
        if (s.items.where(shown).toList() case final items
            when items.isNotEmpty)
          (section: s, items: items),
    ];
    return ListView(
      key: ValueKey('menu-${preview.prototype.name}'),
      padding: const EdgeInsets.only(bottom: HlSpace.s5),
      children: [
        if (preview.updateCard)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              HlSpace.s4,
              HlSpace.s4,
              HlSpace.s4,
              0,
            ),
            child: _UpdateCard(preview.prototype.offer),
          ),
        for (final (i, (:section, :items)) in sections.indexed) ...[
          _Header(
            look: look,
            text: section.header?.call(l10n),
            gap: switch ((i, preview.updateCard)) {
              (0, false) => HlSpace.s2,
              // Below the card, even the compact look keeps a full gap.
              (0, true) => math.max(look.sectionGap, 20),
              _ => look.sectionGap,
            },
          ),
          _Group(
            look: look,
            children: [
              for (final item in items)
                _ProtoRow(
                  item: item,
                  look: look,
                  quiet: section.quiet,
                  household: household?.name,
                ),
            ],
          ),
        ],
        const _Version(),
      ],
    );
  }
}

class const _Header({
  required final _Look look,
  required final String? text,
  required final double gap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    return switch ((look.headers, text)) {
      (_, null) || (_Headers.none, _) => SizedBox(height: gap),
      (_Headers.label, final text?) => HlSectionLabel(
        text,
        padding: EdgeInsets.fromLTRB(20, gap, 20, HlSpace.s1),
      ),
      (_Headers.title, final text?) => Padding(
        padding: EdgeInsets.fromLTRB(20, gap, 20, HlSpace.s1),
        child: Semantics(
          header: true,
          child: Text(text, style: HlType.title.copyWith(color: t.text)),
        ),
      ),
    };
  }
}

/// A section's rows: on their own, or in an inset group with the 2 px
/// contour and the small sticker shadow.
class const _Group({
  required final _Look look,
  required final List<Widget> children,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    if (!look.grouped) {
      return Column(children: children);
    }
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: HlSpace.s4),
      child: HlSticker(
        depth: StickerDepth.s,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(HlRadius.m - HlBorder.width),
          child: Material(
            type: MaterialType.transparency,
            child: Column(
              children: [
                for (final (i, child) in children.indexed) ...[
                  if (i > 0) Divider(height: 1, indent: 60, color: t.divider),
                  child,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class const _ProtoRow({
  required final _Item item,
  required final _Look look,
  required final bool quiet,
  required final String? household,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    void web(Uri url) => unawaited(openLegalPage(url));
    final (icon, label, hint, external, onTap) = switch (item) {
      _Item.invite => (
        Icons.person_add_outlined,
        l10n.inviteMember,
        household,
        false,
        () => context.go(invitesPath),
      ),
      _Item.join => (
        Icons.group_add_outlined,
        l10n.joinOtherHousehold,
        null,
        false,
        () => context.go(joinCodePath),
      ),
      _Item.archived => (
        Icons.inventory_2_outlined,
        l10n.archivedTitle,
        null,
        false,
        () => unawaited(showArchivedHouseholds(context)),
      ),
      _Item.premium => (
        Icons.favorite_outline,
        l10n.premiumTitle,
        null,
        false,
        () => context.go(premiumPath),
      ),
      _Item.access => (
        Icons.key_outlined,
        l10n.accessTitle,
        l10n.accessRowHint,
        false,
        () => context.go(accessPath),
      ),
      _Item.account => (
        Icons.manage_accounts_outlined,
        l10n.account,
        l10n.accountRowHint,
        false,
        () => context.go(accountPath),
      ),
      _Item.privacy => (
        Icons.shield_outlined,
        l10n.menuPrivacy,
        l10n.menuPrivacyHint,
        false,
        () => _openPage(context, _SubPage.privacy, look),
      ),
      _Item.signOut => (
        Icons.logout,
        l10n.signOut,
        null,
        false,
        () => unawaited(context.read<SessionCubit>().signOut()),
      ),
      _Item.settings => (
        Icons.settings_outlined,
        l10n.settingsTitle,
        l10n.settingsRowHint,
        false,
        () => context.go(appSettingsPath),
      ),
      _Item.feedback => (
        Icons.feedback_outlined,
        l10n.feedbackRow,
        l10n.feedbackRowHint,
        false,
        () => unawaited(showFeedbackSheet(context)),
      ),
      _Item.help => (
        Icons.help_outline,
        l10n.helpRow,
        l10n.helpRowHint,
        true,
        () => web(supportUrl(lang)),
      ),
      _Item.legal => (
        Icons.gavel_outlined,
        l10n.legal,
        l10n.menuLegalHint,
        false,
        () => _openPage(context, _SubPage.legal, look),
      ),
      _Item.imprint => (
        Icons.info_outline,
        l10n.imprint,
        null,
        true,
        () => web(imprintUrl(lang)),
      ),
      _Item.privacyPolicy => (
        Icons.privacy_tip_outlined,
        l10n.menuPrivacyPolicy,
        null,
        true,
        () => web(privacyPolicyUrl(lang)),
      ),
      _Item.licenses => (
        Icons.description_outlined,
        l10n.licenses,
        null,
        false,
        () => unawaited(_MoreList._showLicenses(context)),
      ),
    };
    final key = ValueKey('menu-row-${item.name}');
    if (item == _Item.premium) {
      return _PremiumRow(
        selected: false,
        builder: (detail) => _tile(
          context,
          key,
          icon,
          label,
          look.hints ? detail : null,
          external,
          onTap,
        ),
      );
    }
    return _tile(
      context,
      key,
      icon,
      label,
      look.hints ? hint : null,
      external,
      onTap,
    );
  }

  Widget _tile(
    BuildContext context,
    Key key,
    IconData icon,
    String label,
    String? hint,
    bool external,
    VoidCallback onTap,
  ) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    final destructive = item == _Item.signOut && look.signOutApart;
    final ink = destructive ? t.error : (quiet ? t.textMuted : t.text);
    final glyph = Icon(
      icon,
      size: look.icons == _Icons.hex ? 18 : 24,
      color: destructive
          ? t.error
          : (look.icons == _Icons.hex ? t.text : t.textMuted),
    );
    final leading = switch (look.icons) {
      _ when quiet => null,
      _Icons.none => null,
      _Icons.plain => glyph,
      _Icons.hex => PointyHex(face: _tint(t), size: 34, child: glyph),
    };
    final value = look.values && item == _Item.settings
        ? _settingsValue(context)
        : null;
    return ListTile(
      key: key,
      minTileHeight: quiet ? 44 : look.rowHeight,
      dense: quiet,
      contentPadding: EdgeInsets.symmetric(
        horizontal: look.grouped ? HlSpace.s3 : 20,
      ),
      leading: leading,
      title: Text(
        label,
        style: TextStyle(
          color: ink,
          fontSize: quiet ? 14 : null,
          fontWeight: destructive ? FontWeight.w600 : null,
        ),
      ),
      subtitle: hint == null ? null : Text(hint),
      trailing: item == _Item.signOut
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              spacing: HlSpace.s1,
              children: [
                if (value != null)
                  Text(value, style: TextStyle(color: t.textMuted)),
                Icon(
                  external ? Icons.open_in_new : Icons.chevron_right,
                  size: external || quiet ? 18 : 24,
                  color: t.textMuted,
                ),
              ],
            ),
      onTap: onTap,
    );
  }

  /// The hex face per kind of row: honey for the household, cobalt for
  /// connections, mint for you and your data, the sunken surface for the
  /// rest.
  Color _tint(HummlistColors t) => switch (item) {
    _Item.invite ||
    _Item.join ||
    _Item.archived ||
    _Item.premium => t.honeySoft,
    _Item.access => t.accentSoft,
    _Item.account || _Item.privacy || _Item.settings => t.mintSoft,
    _ => t.surfaceSunken,
  };

  static String _settingsValue(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = switch (context.watch<ThemeCubit>().state) {
      ThemeMode.system => l10n.themeSystem,
      ThemeMode.light => l10n.themeLight,
      ThemeMode.dark => l10n.themeDark,
    };
    final language =
        context.watch<LanguageCubit>().state?.nativeName ?? l10n.languageSystem;
    return '$theme · $language';
  }
}

enum _SubPage() {
  privacy,
  legal,
}

void _openPage(BuildContext context, _SubPage page, _Look look) {
  final l10n = AppLocalizations.of(context);
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (context) => Scaffold(
        appBar: AppBar(
          title: Text(switch (page) {
            _SubPage.privacy => l10n.menuPrivacy,
            _SubPage.legal => l10n.legal,
          }),
        ),
        body: _PrototypeSubPage(page: page, look: look),
      ),
    ),
  );
}

/// Privacy (the usage-data switch, the policy) or Legal (imprint, policy,
/// licenses), in the prototype's look.
class const _PrototypeSubPage({
  required final _SubPage page,
  required final _Look look,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final rows = switch (page) {
      _SubPage.privacy => [_Item.privacyPolicy],
      _SubPage.legal => [_Item.imprint, _Item.privacyPolicy, _Item.licenses],
    };
    return ListView(
      key: ValueKey('menu-page-${page.name}'),
      padding: const EdgeInsets.only(bottom: HlSpace.s5),
      children: [
        if (page == _SubPage.privacy && context.read<Analytics>().enabled) ...[
          HlSectionLabel(
            l10n.analyticsSection,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
          ),
          const _AnalyticsSwitch(),
        ],
        SizedBox(
          height: page == _SubPage.privacy ? look.sectionGap : HlSpace.s2,
        ),
        _Group(
          look: look,
          children: [
            for (final item in rows)
              _ProtoRow(item: item, look: look, quiet: false, household: null),
          ],
        ),
      ],
    );
  }
}

/// The one card More may show: a patch is ready (restart) or the store has
/// a newer version (update). Lemon, navy contour, sticker shadow.
class const _UpdateCard(final UpdateOffer offer) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = HummlistColors.of(Theme.of(context).brightness);
    final (title, body, action, icon) = switch (offer) {
      UpdateOffer.patch => (
        l10n.updatePatchTitle,
        l10n.updatePatchBody,
        l10n.updatePatchAction,
        Icons.restart_alt,
      ),
      UpdateOffer.store => (
        l10n.updateStoreTitle,
        l10n.updateStoreBody('1.4.0'),
        l10n.updateStoreAction,
        Icons.system_update_outlined,
      ),
    };
    return HlSticker(
      key: const ValueKey('menu-update-card'),
      color: t.honey,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          HlSpace.s4,
          HlSpace.s3,
          HlSpace.s2,
          HlSpace.s4,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: HlSpace.s3,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: HlSpace.s1),
              child: PointyHex(
                face: HummlistColors.light.surfaceRaised,
                contour: HummlistColors.light.edge,
                size: 36,
                // The lemon card is the same in light and dark.
                child: Icon(icon, size: 20, color: HummlistColors.light.ink),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: HlSpace.s1,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: HlSpace.s1),
                    child: Text(
                      title,
                      style: HlType.title.copyWith(color: t.onHoney),
                    ),
                  ),
                  Text(body, style: HlType.body.copyWith(color: t.onHoney)),
                  const SizedBox(height: HlSpace.s2),
                  FilledButton(
                    key: const ValueKey('menu-update-action'),
                    onPressed: () => menuPreview.value = (
                      prototype: menuPreview.value!.prototype,
                      updateCard: false,
                    ),
                    child: Text(action),
                  ),
                ],
              ),
            ),
            IconButton(
              key: const ValueKey('menu-update-later'),
              tooltip: l10n.updateLater,
              icon: Icon(Icons.close, color: t.onHoney),
              onPressed: () => menuPreview.value = (
                prototype: menuPreview.value!.prototype,
                updateCard: false,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The debug switcher: today's menu or a prototype, with or without the
/// update card.
class const _PrototypeSwitch() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => IconButton(
    key: const ValueKey('menu-prototypes'),
    tooltip: AppLocalizations.of(context).menuProtoSwitch,
    icon: const Icon(Icons.science_outlined),
    onPressed: () => unawaited(
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (context) => ValueListenableBuilder(
          valueListenable: menuPreview,
          builder: (context, preview, _) {
            final l10n = AppLocalizations.of(context);
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  title: Text(l10n.menuProtoCurrent),
                  selected: preview == null,
                  onTap: () => menuPreview.value = null,
                ),
                for (final p in MenuPrototype.values)
                  ListTile(
                    key: ValueKey('menu-prototype-${p.name}'),
                    title: Text(p.title(l10n)),
                    selected: preview?.prototype == p,
                    onTap: () => menuPreview.value = (
                      prototype: p,
                      updateCard: preview?.updateCard ?? false,
                    ),
                  ),
                HexSwitchTile(
                  title: Text(l10n.menuProtoUpdateCard),
                  value: preview?.updateCard ?? false,
                  onChanged: preview == null
                      ? null
                      : (on) => menuPreview.value = (
                          prototype: preview.prototype,
                          updateCard: on,
                        ),
                ),
              ],
            );
          },
        ),
      ),
    ),
  );
}
