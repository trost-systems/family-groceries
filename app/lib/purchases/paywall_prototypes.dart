import 'dart:async';

import 'package:family_groceries/app/guides.dart';
import 'package:family_groceries/app/legal_links.dart';
import 'package:family_groceries/design/hex_radio.dart';
import 'package:family_groceries/design/hex_segmented.dart';
import 'package:family_groceries/design/pointy_hex.dart';
import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/premium_server.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/store_prices.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Job 81: five paywall prototypes for Peter to compare (docs/design/
/// paywall-research.md, site/public/internal/paywall-prototypes.html). Debug
/// builds only; nothing here buys, restores or reads a store. Each shows the
/// two plans with the prices it is given and the disclosures today's page
/// has, in its own layout.
enum PaywallPrototype() {
  /// Benefit hero, feature list, plan picker, one button.
  p1,

  /// Lifetime first, yearly as the second choice.
  p2,

  /// Free next to Premium, then a plan toggle.
  p3,

  /// One buys, the household has it: plans as two tiles.
  p4,

  /// A bottom sheet from the integration lock.
  p5;

  String label(AppLocalizations l10n) => switch (this) {
    p1 => l10n.paywallProtoName1,
    p2 => l10n.paywallProtoName2,
    p3 => l10n.paywallProtoName3,
    p4 => l10n.paywallProtoName4,
    p5 => l10n.paywallProtoName5,
  };
}

/// The prototype the Premium page shows instead of itself; null for today's
/// page. With [PaywallPrototype.p5], the integration lock's button opens it
/// as a sheet.
final paywallPrototype = ValueNotifier<PaywallPrototype?>(null);

/// Whether the Premium page shows the switch in a debug build. Off under
/// `flutter test` (test/flutter_test_config.dart), so other tests' shots of
/// the page stay as they are.
bool showPaywallPrototypeSwitch = kDebugMode;

/// The launch prices as configured (docs/PURCHASES.md, "Expected prices";
/// `scripts/iap/product.ts`), for a page that read none from a store.
final Map<PremiumPlan, StorePrice> configuredPrices = fakeStorePrices.prices;

/// The debug row on the Premium page that picks a prototype.
class const PaywallPrototypeSwitch({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ValueListenableBuilder(
      valueListenable: paywallPrototype,
      builder: (context, picked, _) => ListTile(
        key: const ValueKey('paywall-prototype-switch'),
        leading: const Icon(Icons.science_outlined),
        title: Text(l10n.paywallProtoSwitch),
        trailing: DropdownButton<PaywallPrototype?>(
          value: picked,
          onChanged: (p) => paywallPrototype.value = p,
          items: [
            DropdownMenuItem(child: Text(l10n.paywallProtoToday)),
            for (final p in PaywallPrototype.values)
              DropdownMenuItem(value: p, child: Text(p.label(l10n))),
          ],
        ),
      ),
    );
  }
}

/// [prototype] as a page, with [prices] (a plan missing there shows
/// "€X,XX").
class const PaywallPrototypeView({
  required final PaywallPrototype prototype,
  required final Map<PremiumPlan, StorePrice> prices,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 640),
      child: ListView(
        key: ValueKey('paywall-${prototype.name}'),
        padding: const EdgeInsets.fromLTRB(
          HlSpace.s4,
          HlSpace.s2,
          HlSpace.s4,
          HlSpace.s5,
        ),
        children: [
          switch (prototype) {
            PaywallPrototype.p1 => _P1(prices: prices),
            PaywallPrototype.p2 => _P2(prices: prices),
            PaywallPrototype.p3 => _P3(prices: prices),
            PaywallPrototype.p4 => _P4(prices: prices),
            PaywallPrototype.p5 => _P5(prices: prices, sheet: false),
          },
        ],
      ),
    ),
  );
}

/// PW-P5 as the integration lock opens it.
Future<void> showLockPaywall(BuildContext context) => showModalBottomSheet(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (context) => SafeArea(
    child: SingleChildScrollView(
      key: const ValueKey('paywall-p5-sheet'),
      padding: const EdgeInsets.fromLTRB(HlSpace.s4, 0, HlSpace.s4, HlSpace.s4),
      child: _P5(prices: configuredPrices, sheet: true),
    ),
  ),
);

/// The plan's price as the store formats it, with its period; "€X,XX" for a
/// plan the store did not price.
String _amount(
  AppLocalizations l10n,
  PremiumPlan plan,
  Map<PremiumPlan, StorePrice> prices,
) {
  final shown = prices[plan]?.formatted ?? l10n.paywallPriceUnknown;
  return switch (plan) {
    PremiumPlan.yearly => l10n.premiumYearlyPrice(shown),
    PremiumPlan.lifetime => l10n.premiumLifetimePrice(shown),
  };
}

/// As today's page: "inkl. MwSt." only after a price in euros (K.13.P.3).
bool _withVat(PremiumPlan plan, Map<PremiumPlan, StorePrice> prices) =>
    prices[plan]?.euro ?? true;

String _price(
  AppLocalizations l10n,
  PremiumPlan plan,
  Map<PremiumPlan, StorePrice> prices,
) {
  final amount = _amount(l10n, plan, prices);
  return _withVat(plan, prices) ? '$amount ${l10n.premiumVat}' : amount;
}

/// A price as the one big number, "inkl. MwSt." small under it.
class const _BigPrice({
  required final PremiumPlan plan,
  required final Map<PremiumPlan, StorePrice> prices,
  required final double size,
  final CrossAxisAlignment align = CrossAxisAlignment.start,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(_amount(l10n, plan, prices), style: _display(context, size)),
          if (_withVat(plan, prices))
            Text(l10n.premiumVat, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

String _planTitle(AppLocalizations l10n, PremiumPlan plan) => switch (plan) {
  PremiumPlan.yearly => l10n.premiumYearlyTitle,
  PremiumPlan.lifetime => l10n.premiumLifetimeTitle,
};

String _buyLabel(AppLocalizations l10n, PremiumPlan plan) => switch (plan) {
  PremiumPlan.yearly => l10n.premiumBuyYearly,
  PremiumPlan.lifetime => l10n.premiumBuyLifetime,
};

void _noPurchase(BuildContext context) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(AppLocalizations.of(context).paywallProtoNoPurchase),
      ),
    );
}

TextStyle _display(BuildContext context, double size) {
  final t = HummlistColors.of(Theme.of(context).brightness);
  return TextStyle(
    fontFamily: HlFont.display,
    fontSize: size,
    fontWeight: FontWeight.w800,
    height: 1.1,
    letterSpacing: -0.02 * size,
    color: t.text,
  );
}

/// The four things Premium gives, one line each.
List<(IconData, String)> _benefits(AppLocalizations l10n) => [
  (Icons.mic_none, l10n.paywallSiri),
  (Icons.smart_toy_outlined, l10n.paywallAi),
  (Icons.terminal, l10n.paywallApi),
  (Icons.home_outlined, l10n.paywallHousehold),
];

class const _Benefit(final IconData icon, final String text)
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = HummlistColors.of(Theme.of(context).brightness);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: HlSpace.s1),
      child: Row(
        children: [
          PointyHex(
            face: t.honey,
            size: 30,
            child: Icon(icon, size: 16, color: t.onHoney),
          ),
          const SizedBox(width: HlSpace.s3),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

/// The full-width buy button; prototypes only say they buy nothing.
class const _Cta(final String label, {super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton(
      onPressed: () => _noPurchase(context),
      child: Text(label),
    ),
  );
}

/// What the picked plan means: the yearly disclosures (3.1.2) or Lifetime's
/// value line, both as today's page words them.
class const _Terms(final PremiumPlan plan) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: HlSpace.s3),
      child: Text(
        switch (plan) {
          PremiumPlan.yearly => l10n.premiumYearlyTerms,
          PremiumPlan.lifetime => l10n.premiumLifetimeValue,
        },
        key: ValueKey('paywall-terms-${plan.name}'),
        style: theme.textTheme.bodySmall,
      ),
    );
  }
}

/// Restore, terms and privacy, as on today's page.
class const _Footer() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final language = Localizations.localeOf(context).languageCode;
    const small = TextStyle(fontSize: 12, fontWeight: FontWeight.w600);
    final tight = TextButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: HlSpace.s2),
    );
    Widget link(String id, String label, Uri url) => LegalLink(
      key: ValueKey(id),
      url: url,
      builder: (context, open) => TextButton(
        style: tight,
        onPressed: open,
        child: Text(label, style: small),
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(top: HlSpace.s2),
      child: Column(
        children: [
          TextButton(
            key: const ValueKey('paywall-restore'),
            style: tight,
            onPressed: () => _noPurchase(context),
            child: Text(l10n.lifetimeRestore, style: small),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: link(
                  'paywall-terms-link',
                  l10n.premiumTermsLink,
                  termsUrl(defaultTargetPlatform, language),
                ),
              ),
              Flexible(
                child: link(
                  'paywall-privacy-link',
                  l10n.premiumPrivacyLink,
                  privacyPolicyUrl(language),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A plan picked by the user; yearly to start with, as today's page lists it
/// first.
abstract class _PickerState<W extends StatefulWidget>() extends State<W> {
  var plan = PremiumPlan.yearly;

  void pick(PremiumPlan? p) {
    if (p != null) {
      setState(() => plan = p);
    }
  }
}

/// PW-P1 Klassisch: a honey hero with the benefit, four benefit lines, the
/// plans as radio rows, one button. RevenueCat's most common template shape.
class const _P1({required final Map<PremiumPlan, StorePrice> prices})
    extends StatefulWidget {
  @override
  State<_P1> createState() => _P1State();
}

class _P1State() extends _PickerState<_P1> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = HummlistColors.of(Theme.of(context).brightness);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HlSticker(
          color: t.honey,
          child: Padding(
            padding: const EdgeInsets.all(HlSpace.s5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Image.asset(
                    'assets/brand/mark-${dark ? 'dark' : 'light'}.png',
                    width: 44,
                    height: 44,
                  ),
                ),
                const SizedBox(height: HlSpace.s4),
                Semantics(
                  header: true,
                  child: Text(
                    l10n.paywallP1Title,
                    style: _display(context, 28).copyWith(color: t.onHoney),
                  ),
                ),
                const SizedBox(height: HlSpace.s2),
                Text(
                  l10n.paywallP1Body,
                  style: TextStyle(color: t.onHoney, height: 1.35),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: HlSpace.s4),
        for (final (icon, text) in _benefits(l10n)) _Benefit(icon, text),
        const SizedBox(height: HlSpace.s4),
        RadioGroup<PremiumPlan>(
          groupValue: plan,
          onChanged: pick,
          child: HlSticker(
            depth: StickerDepth.s,
            child: Material(
              type: MaterialType.transparency,
              child: Column(
                children: [
                  for (final p in PremiumPlan.values)
                    HexRadioTile(
                      key: ValueKey('paywall-plan-${p.name}'),
                      value: p,
                      title: Text(_planTitle(l10n, p)),
                      subtitle: Text(_price(l10n, p, widget.prices)),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: HlSpace.s4),
        _Cta(l10n.paywallContinue, key: const ValueKey('paywall-buy')),
        _Terms(plan),
        const _Footer(),
      ],
    );
  }
}

/// PW-P2 Einmal zahlen: Lifetime as the hero, its price the one big number;
/// the yearly plan below as the quieter second choice.
class const _P2({required final Map<PremiumPlan, StorePrice> prices})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final t = HummlistColors.of(theme.brightness);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: HlSpace.s3),
        Center(
          child: PointyHex(
            face: t.honey,
            size: 72,
            child: Icon(Icons.all_inclusive, size: 32, color: t.onHoney),
          ),
        ),
        const SizedBox(height: HlSpace.s4),
        Semantics(
          header: true,
          child: Text(
            l10n.paywallP2Title,
            textAlign: TextAlign.center,
            style: _display(context, 30),
          ),
        ),
        const SizedBox(height: HlSpace.s2),
        Text(l10n.paywallP2Body, textAlign: TextAlign.center),
        const SizedBox(height: HlSpace.s5),
        HlSticker(
          key: const ValueKey('paywall-plan-lifetime'),
          child: Padding(
            padding: const EdgeInsets.all(HlSpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _planTitle(l10n, PremiumPlan.lifetime),
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: HlSpace.s1),
                _BigPrice(plan: PremiumPlan.lifetime, prices: prices, size: 30),
                const SizedBox(height: HlSpace.s3),
                for (final (icon, text) in _benefits(l10n))
                  _Benefit(icon, text),
                const SizedBox(height: HlSpace.s4),
                _Cta(
                  l10n.premiumBuyLifetime,
                  key: const ValueKey('paywall-buy-lifetime'),
                ),
                const _Terms(PremiumPlan.lifetime),
              ],
            ),
          ),
        ),
        const SizedBox(height: HlSpace.s5),
        Text(l10n.paywallP2OrYearly, style: theme.textTheme.titleSmall),
        const SizedBox(height: HlSpace.s1),
        Text(
          _price(l10n, PremiumPlan.yearly, prices),
          key: const ValueKey('paywall-plan-yearly'),
        ),
        const SizedBox(height: HlSpace.s2),
        OutlinedButton(
          key: const ValueKey('paywall-buy-yearly'),
          onPressed: () => _noPurchase(context),
          child: Text(l10n.premiumBuyYearly),
        ),
        const _Terms(PremiumPlan.yearly),
        const _Footer(),
      ],
    );
  }
}

/// PW-P3 Vergleich: what is free and what Premium adds, side by side; then
/// the plans as a toggle.
class const _P3({required final Map<PremiumPlan, StorePrice> prices})
    extends StatefulWidget {
  @override
  State<_P3> createState() => _P3State();
}

class _P3State() extends _PickerState<_P3> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final t = HummlistColors.of(theme.brightness);
    Widget mark({required bool included}) => Semantics(
      label: included ? l10n.paywallIncluded : l10n.paywallNotIncluded,
      child: ExcludeSemantics(
        child: included
            ? PointyHex(
                face: t.mint,
                size: 24,
                child: Icon(Icons.check, size: 14, color: t.onMint),
              )
            : Icon(Icons.remove, size: 18, color: t.textMuted),
      ),
    );
    TableRow row(String name, {required bool free}) => TableRow(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: HlSpace.s2),
          child: Text(name),
        ),
        Center(child: mark(included: free)),
        Center(child: mark(included: true)),
      ],
    );
    final head = theme.textTheme.labelLarge?.copyWith(color: t.textMuted);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: HlSpace.s2),
        Semantics(
          header: true,
          child: Text(l10n.paywallP3Title, style: _display(context, 28)),
        ),
        const SizedBox(height: HlSpace.s4),
        HlSticker(
          depth: StickerDepth.s,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              HlSpace.s4,
              HlSpace.s3,
              HlSpace.s3,
              HlSpace.s3,
            ),
            child: Table(
              key: const ValueKey('paywall-compare'),
              columnWidths: const {
                0: FlexColumnWidth(),
                1: FixedColumnWidth(84),
                2: FixedColumnWidth(84),
              },
              defaultVerticalAlignment: TableCellVerticalAlignment.middle,
              children: [
                TableRow(
                  children: [
                    const SizedBox.shrink(),
                    Center(child: Text(l10n.paywallP3Free, style: head)),
                    Center(
                      child: Text(
                        l10n.paywallP3Premium,
                        style: head?.copyWith(color: t.accent),
                      ),
                    ),
                  ],
                ),
                row(l10n.paywallP3List, free: true),
                row(l10n.paywallP3Sync, free: true),
                row(l10n.paywallP3Alexa, free: true),
                row(l10n.paywallP3Siri, free: false),
                row(l10n.paywallP3Ai, free: false),
                row(l10n.paywallP3Api, free: false),
              ],
            ),
          ),
        ),
        const SizedBox(height: HlSpace.s5),
        Text(l10n.paywallP3Plan, style: theme.textTheme.titleSmall),
        const SizedBox(height: HlSpace.s2),
        HexSegmented<PremiumPlan>(
          label: l10n.paywallP3Plan,
          value: plan,
          onChanged: pick,
          segments: [
            for (final p in PremiumPlan.values)
              HexSegment(
                key: ValueKey('paywall-plan-${p.name}'),
                value: p,
                label: _planTitle(l10n, p),
              ),
          ],
        ),
        const SizedBox(height: HlSpace.s4),
        _BigPrice(
          key: const ValueKey('paywall-price'),
          plan: plan,
          prices: widget.prices,
          size: 28,
          align: CrossAxisAlignment.center,
        ),
        const SizedBox(height: HlSpace.s4),
        _Cta(_buyLabel(l10n, plan), key: const ValueKey('paywall-buy')),
        _Terms(plan),
        const _Footer(),
      ],
    );
  }
}

/// PW-P4 Haushalt: the household as the hero (one buys, everyone has it);
/// the plans as two tiles side by side.
class const _P4({required final Map<PremiumPlan, StorePrice> prices})
    extends StatefulWidget {
  @override
  State<_P4> createState() => _P4State();
}

class _P4State() extends _PickerState<_P4> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final t = HummlistColors.of(theme.brightness);
    final members = [
      (t.cobalt, t.onCobalt),
      (t.mint, t.onMint),
      (t.tomato, t.onTomato),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: HlSpace.s3),
        ExcludeSemantics(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (final (face, ink) in members)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: PointyHex(
                    face: face,
                    size: 56,
                    child: Icon(Icons.person_outline, color: ink),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: PointyHex(
                  face: t.surfaceRaised,
                  size: 56,
                  child: Icon(Icons.add, color: t.text),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: HlSpace.s4),
        Semantics(
          header: true,
          child: Text(
            l10n.paywallP4Title,
            textAlign: TextAlign.center,
            style: _display(context, 28),
          ),
        ),
        const SizedBox(height: HlSpace.s2),
        Text(l10n.paywallP4Body, textAlign: TextAlign.center),
        const SizedBox(height: HlSpace.s4),
        for (final (icon, text) in _benefits(l10n).take(3))
          _Benefit(icon, text),
        const SizedBox(height: HlSpace.s4),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final p in PremiumPlan.values) ...[
                if (p != PremiumPlan.values.first)
                  const SizedBox(width: HlSpace.s3),
                Expanded(
                  child: _PlanTile(
                    plan: p,
                    price: _amount(l10n, p, widget.prices),
                    vat: _withVat(p, widget.prices),
                    picked: p == plan,
                    onTap: () => pick(p),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: HlSpace.s4),
        _Cta(l10n.paywallContinue, key: const ValueKey('paywall-buy')),
        _Terms(plan),
        const _Footer(),
      ],
    );
  }
}

class const _PlanTile({
  required final PremiumPlan plan,
  required final String price,
  required final bool vat,
  required final bool picked,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final t = HummlistColors.of(theme.brightness);
    final ink = picked ? t.onHoney : t.text;
    return Semantics(
      button: true,
      selected: picked,
      child: HlSticker(
        key: ValueKey('paywall-plan-${plan.name}'),
        depth: picked ? StickerDepth.m : StickerDepth.s,
        color: picked ? t.honey : null,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(HlRadius.m),
            child: Padding(
              padding: const EdgeInsets.all(HlSpace.s3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _planTitle(l10n, plan),
                    style: theme.textTheme.titleMedium?.copyWith(color: ink),
                  ),
                  const SizedBox(height: HlSpace.s1),
                  Text(price, style: TextStyle(color: ink, height: 1.3)),
                  if (vat)
                    Text(
                      l10n.premiumVat,
                      style: theme.textTheme.bodySmall?.copyWith(color: ink),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// PW-P5 Aus der Sperre: what the household just hit (its connections are
/// paused), that Alexa stays free, the plans as compact rows. As a sheet it
/// also has "Später".
class const _P5({
  required final Map<PremiumPlan, StorePrice> prices,
  required final bool sheet,
}) extends StatefulWidget {
  @override
  State<_P5> createState() => _P5State();
}

class _P5State() extends _PickerState<_P5> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final t = HummlistColors.of(theme.brightness);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PointyHex(
              face: t.honey,
              size: 44,
              child: Icon(Icons.mic_none, size: 22, color: t.onHoney),
            ),
            const SizedBox(width: HlSpace.s3),
            Expanded(
              child: Semantics(
                header: true,
                child: Text(l10n.paywallP5Title, style: _display(context, 22)),
              ),
            ),
          ],
        ),
        const SizedBox(height: HlSpace.s3),
        Text(l10n.paywallP5Body),
        const SizedBox(height: HlSpace.s2),
        Row(
          children: [
            Icon(Icons.check_circle_outline, size: 18, color: t.success),
            const SizedBox(width: HlSpace.s2),
            Text(l10n.paywallAlexaFree, style: theme.textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: HlSpace.s3),
        RadioGroup<PremiumPlan>(
          groupValue: plan,
          onChanged: pick,
          child: Column(
            children: [
              for (final p in PremiumPlan.values)
                HexRadioTile(
                  key: ValueKey('paywall-plan-${p.name}'),
                  value: p,
                  title: Text(_planTitle(l10n, p)),
                  subtitle: Text(_price(l10n, p, widget.prices)),
                ),
            ],
          ),
        ),
        const SizedBox(height: HlSpace.s3),
        _Cta(_buyLabel(l10n, plan), key: const ValueKey('paywall-buy')),
        if (widget.sheet)
          TextButton(
            key: const ValueKey('paywall-later'),
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.paywallLater),
          ),
        _Terms(plan),
        const _Footer(),
      ],
    );
  }
}
