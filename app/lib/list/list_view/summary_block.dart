import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/list_view/price_views.dart'
    show TotalBar, moneyLocale;
import 'package:family_groceries/list/pricing.dart';
import 'package:family_groceries/list/subtotals.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

const _figures = [FontFeature.tabularFigures()];

/// [sum]'s amount as shown, or for screen readers when [spoken]: „mind.“
/// with items unpriced when [floor], „≈“ with an estimate in it. Null when
/// nothing in it has a price.
String? sumText(
  BuildContext context,
  Sum sum, {
  required String currency,
  bool floor = true,
  bool spoken = false,
}) {
  if (sum.empty) {
    return null;
  }
  final l10n = AppLocalizations.of(context);
  var text = formatMoney(
    sum.cents,
    currency: currency,
    locale: moneyLocale(context),
  );
  if (sum.estimate) {
    text = spoken ? l10n.moneyEstimateSpoken(text) : l10n.moneyEstimate(text);
  }
  if (floor && sum.floor) {
    text = spoken ? l10n.moneyAtLeastSpoken(text) : l10n.moneyAtLeast(text);
  }
  return text;
}

/// ST3 (job 237, flag `list-declutter`): where job 229's total row was,
/// „Einkaufssumme“, a line per store (name, „2 ohne Preis“, subtotal; a tap
/// scrolls to its section) and „Gesamt“. One store: „Gesamt“ alone. While a
/// trip runs on the list, each line splits bought and open.
class const SummaryBlock({
  required final Summary summary,
  required final String currency,

  /// Scrolls to the section of the store line's key.
  required final ValueChanged<String> onJump,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = SnacklistColors.of(Theme.of(context).brightness);
    if (summary.total.priced > 0) {
      final cubit = context.read<ListCubit>();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          cubit.totalViewed();
        }
      });
    }
    return Container(
      key: const ValueKey('summary-block'),
      // Inset as the rows' text, the line as wide as theirs.
      margin: const EdgeInsets.fromLTRB(HlSpace.s4, HlSpace.s3, HlSpace.s4, 0),
      padding: const EdgeInsets.symmetric(horizontal: HlSpace.s1),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: t.text, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (summary.perStore) ...[
            Padding(
              padding: const EdgeInsets.only(
                top: HlSpace.s3,
                bottom: HlSpace.s1,
              ),
              child: ExcludeSemantics(
                child: Text(
                  l10n.tripTotal.toUpperCase(),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: t.textMuted,
                  ),
                ),
              ),
            ),
            for (final tally in summary.stores)
              _StoreLine(
                tally: tally,
                currency: currency,
                onJump: tally.allBought ? null : () => onJump(tally.key),
              ),
            Divider(
              height: HlSpace.s2,
              thickness: HlBorder.width,
              color: t.border,
            ),
          ],
          _TotalLine(summary: summary, currency: currency),
        ],
      ),
    );
  }
}

/// What a line says under its name: while a trip runs bought and open (or
/// „alles gekauft“), then how many have no price. [spoken] for screen
/// readers.
List<String> _details(
  BuildContext context,
  Sum? bought,
  Sum open,
  String currency, {
  required bool allBought,
  bool spoken = false,
}) {
  final l10n = AppLocalizations.of(context);
  String part(Sum sum) =>
      sumText(context, sum, currency: currency, floor: false, spoken: spoken) ??
      formatMoney(0, currency: currency, locale: moneyLocale(context));
  final unpriced = (bought ?? Sum.zero).unpriced + open.unpriced;
  return [
    if (bought != null) ...[
      if (allBought)
        l10n.subtotalsAllBought
      else ...[
        l10n.subtotalsBought(part(bought)),
        l10n.subtotalsOpen(part(open)),
      ],
    ],
    if (unpriced > 0) l10n.subtotalsUnpriced(unpriced),
  ];
}

class const _StoreLine({
  required final StoreTally tally,
  required final String currency,

  /// Null for a store bought in full: it has no section to go to.
  required final VoidCallback? onJump,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = SnacklistColors.of(Theme.of(context).brightness);
    final name = tally.store?.name ?? l10n.noStore;
    final amount = sumText(context, tally.sum, currency: currency);
    List<String> details({bool spoken = false}) => _details(
      context,
      tally.bought,
      tally.open,
      currency,
      allBought: tally.allBought,
      spoken: spoken,
    );
    final shown = details();
    final line = Container(
      constraints: const BoxConstraints(minHeight: HlSize.target),
      padding: const EdgeInsets.symmetric(vertical: HlSpace.s1),
      child: Row(
        spacing: HlSpace.s3,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: t.text,
                  ),
                ),
                if (shown.isNotEmpty)
                  Text.rich(
                    TextSpan(
                      children: [
                        if (tally.allBought && tally.bought != null)
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: Padding(
                              padding: const EdgeInsetsDirectional.only(end: 2),
                              child: Icon(
                                Icons.check,
                                size: 14,
                                color: t.textMuted,
                              ),
                            ),
                          ),
                        TextSpan(text: shown.join(' · ')),
                      ],
                    ),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: t.textMuted,
                      fontFeatures: _figures,
                    ),
                  ),
              ],
            ),
          ),
          if (amount != null)
            Flexible(
              child: Text(
                amount,
                key: ValueKey('subtotal-amount-${tally.key}'),
                textAlign: TextAlign.end,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: t.text,
                  fontFeatures: _figures,
                ),
              ),
            ),
        ],
      ),
    );
    return Semantics(
      key: ValueKey('subtotal-${tally.key}'),
      container: true,
      button: onJump != null,
      label: [
        name,
        ?sumText(context, tally.sum, currency: currency, spoken: true),
        ...details(spoken: true),
      ].join(', '),
      hint: onJump == null ? null : l10n.subtotalsJump,
      onTap: onJump,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onJump,
        child: line,
      ),
    );
  }
}

class const _TotalLine({
  required final Summary summary,
  required final String currency,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = SnacklistColors.of(Theme.of(context).brightness);
    final total = summary.total;
    final amount = sumText(context, total, currency: currency);
    final title = summary.perStore ? l10n.subtotalsTotal : l10n.tripTotal;
    // Without a trip the app's count wording (ST-Q6); with one „offen“
    // names the open amount, so the count says „ohne Preis“.
    List<String> details({bool spoken = false}) => summary.split
        ? _details(
            context,
            summary.bought,
            summary.open,
            currency,
            allBought: false,
            spoken: spoken,
          )
        : [l10n.tripCounts(total.priced, total.unpriced)];
    return Semantics(
      key: const ValueKey('total-bar'),
      container: true,
      label: [
        title,
        ?sumText(context, total, currency: currency, spoken: true),
        ...details(spoken: true),
      ].join(', '),
      excludeSemantics: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: TotalBar.height),
        padding: const EdgeInsets.symmetric(vertical: HlSpace.s1),
        child: Row(
          spacing: HlSpace.s3,
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: summary.perStore ? 17 : 15,
                      fontWeight: FontWeight.w800,
                      color: t.text,
                    ),
                  ),
                  Text(
                    details().join(' · '),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: t.textMuted,
                      fontFeatures: _figures,
                    ),
                  ),
                ],
              ),
            ),
            if (amount != null)
              Flexible(
                child: Text(
                  amount,
                  key: const ValueKey('total-amount'),
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    fontFamily: HlFont.display,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: t.text,
                    fontFeatures: _figures,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
