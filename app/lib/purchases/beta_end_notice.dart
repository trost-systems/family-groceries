import 'dart:async';

import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/app/guides.dart';
import 'package:family_groceries/app/legal_links.dart';
import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/siri/siri_channel.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// How long before the free beta unlock ends its notice shows: at least four
/// weeks (Legal, N-55).
const betaEndNoticeLead = Duration(days: 28);

/// Tester and App Review grants end 2100-01-01 (or never): no beta grant
/// ends this late.
final _testerGrantsFrom = DateTime.utc(2099);

/// The end of the household's free beta unlock to announce at [now], or null
/// (N-55). Only a household whose premium is a RevenueCat promotional grant
/// alone, ending within [betaEndNoticeLead]; never a tester's or App
/// Review's, one that also bought premium, or one whose notice was closed for
/// that end ([dismissed]).
DateTime? betaEndToAnnounce(
  HouseholdUnlocks unlocks, {
  required DateTime now,
  DateTime? dismissed,
}) {
  final grants = [
    for (final r in unlocks.rows)
      if (r.source == PremiumSource.promotional) r.expiresAt,
  ];
  if (grants.isEmpty ||
      grants.any((end) => end == null || !end.isBefore(_testerGrantsFrom)) ||
      unlocks.rows.any(
        (r) => r.source != PremiumSource.promotional && r.activeAt(now),
      )) {
    return null;
  }
  final end = grants.nonNulls.reduce((a, b) => b.isAfter(a) ? b : a);
  final shown =
      !now.isBefore(end.subtract(betaEndNoticeLead)) &&
      now.isBefore(end) &&
      !(dismissed?.isAtSameMomentAs(end) ?? false);
  return shown ? end : null;
}

/// Whether the notice may name Siri (5a): native Siri is live in this build
/// ([define]) and on this platform. Otherwise it names AI assistants only
/// (5b).
bool nativeSiriLive({
  required bool web,
  required TargetPlatform platform,
  bool define = Environment.nativeSiriLive,
}) => define && siriChannelFor(web: web, platform: platform) != null;

/// Which end date's notice was closed, per household: `DeviceCache` in the
/// app.
abstract interface class BetaEndNoticeStore() {
  Future<DateTime?> dismissedBetaEnd(String householdId);

  Future<void> saveDismissedBetaEnd(String householdId, DateTime end);
}

/// The end date to announce, or null. Follows [Entitlements]: a new end date
/// shows the notice again, a purchase or the end itself hides it.
class BetaEndNoticeCubit(
  final Entitlements _entitlements,
  final BetaEndNoticeStore _store,
) extends Cubit<DateTime?> {
  this : super(null) {
    _unlocks = _entitlements.stream.listen((s) => unawaited(_update(s)));
    unawaited(_update(_entitlements.state));
  }

  late final StreamSubscription<EntitlementsState> _unlocks;

  /// Only the latest read may emit; a close counts as one.
  var _reads = 0;

  Future<void> _update(EntitlementsState state) async {
    final read = ++_reads;
    final end = switch (state) {
      EntitlementsKnown(:final householdId, :final unlocks) =>
        betaEndToAnnounce(
          unlocks,
          now: _entitlements.clock,
          dismissed: await _store.dismissedBetaEnd(householdId),
        ),
      EntitlementsUnknown() => null,
    };
    if (!isClosed && read == _reads) {
      emit(end);
    }
  }

  void dismiss() {
    if ((state, _entitlements.state) case (
      final end?,
      EntitlementsKnown(:final householdId),
    )) {
      _reads++;
      unawaited(_store.saveDismissedBetaEnd(householdId, end));
      emit(null);
    }
  }

  @override
  Future<void> close() async {
    await _unlocks.cancel();
    await super.close();
  }
}

/// "Kostenlose Beta-Freischaltung endet am …" at the top of the list (N-55),
/// with a link to the privacy policy and an X. Without [Entitlements] or a
/// [BetaEndNoticeStore] above it there is none. [siriLive] defaults to
/// [nativeSiriLive] here.
class const BetaEndNotice({final bool? siriLive, super.key})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final entitlements = context.read<Entitlements?>();
    final store = context.read<BetaEndNoticeStore?>();
    if (entitlements == null || store == null) {
      return const SizedBox.shrink();
    }
    return BlocProvider(
      create: (_) => BetaEndNoticeCubit(entitlements, store),
      child: _NoticeSlot(
        siriLive:
            siriLive ??
            nativeSiriLive(web: kIsWeb, platform: defaultTargetPlatform),
      ),
    );
  }
}

class const _NoticeSlot({required final bool siriLive})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final end = context.watch<BetaEndNoticeCubit>().state;
    if (end == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: HlSpace.s3,
        vertical: HlSpace.s2,
      ),
      child: BetaEndNoticeCard(
        end: end,
        siriLive: siriLive,
        onClose: context.read<BetaEndNoticeCubit>().dismiss,
      ),
    );
  }
}

/// The notice itself: title, text, the privacy link and the X, nothing else
/// (no price, no button to buy).
class const BetaEndNoticeCard({
  required final DateTime end,
  required final bool siriLive,
  required final VoidCallback onClose,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final language = Localizations.localeOf(context).languageCode;
    final t = HummlistColors.of(Theme.of(context).brightness);
    final date = end.toLocal();
    return Semantics(
      key: const ValueKey('beta-end-notice'),
      container: true,
      child: HlSticker(
        depth: StickerDepth.s,
        child: Padding(
          padding: const EdgeInsetsDirectional.only(
            start: HlSpace.s3,
            top: HlSpace.s1,
            bottom: HlSpace.s1,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: HlSpace.s3,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: HlSpace.s3),
                child: Icon(Icons.event_outlined, size: 22, color: t.brand),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(
                    top: HlSpace.s3,
                    bottom: HlSpace.s2,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: HlSpace.s1,
                    children: [
                      MergeSemantics(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: HlSpace.s1,
                          children: [
                            Text(
                              l10n.betaEndNoticeTitle(date),
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.3,
                                fontWeight: FontWeight.w700,
                                color: t.text,
                              ),
                            ),
                            Text(
                              siriLive
                                  ? l10n.betaEndNoticeBodySiri(date)
                                  : l10n.betaEndNoticeBodyAi(date),
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.35,
                                color: t.text,
                              ),
                            ),
                          ],
                        ),
                      ),
                      LegalLink(
                        key: const ValueKey('beta-end-notice-privacy'),
                        url: betaPrivacyUrl(language),
                        builder: (context, open) => TextButton(
                          onPressed: open,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                          child: Text(l10n.betaEndNoticePrivacyLink),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              IconButton(
                key: const ValueKey('beta-end-notice-close'),
                onPressed: onClose,
                tooltip: l10n.close,
                constraints: const BoxConstraints.tightFor(
                  width: 48,
                  height: 48,
                ),
                icon: Icon(Icons.close, size: 20, color: t.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
