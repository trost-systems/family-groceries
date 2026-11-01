import 'package:family_groceries/app/guides.dart';
import 'package:flutter/foundation.dart' show TargetPlatform, immutable;
import 'package:supabase_flutter/supabase_flutter.dart';

/// What only the subscriber learns about the household's yearly plan
/// (`my_yearly_plan()`, H-87): other members read its end date and nothing
/// about who pays or whether a payment failed.
@immutable
class const MyYearlyPlan({
  /// The caller took out an active yearly plan for their household.
  final bool subscriber = false,

  /// That plan renews.
  final bool renewing = false,

  /// The store could not charge its renewal; premium runs until [until].
  final bool billingIssue = false,
  final DateTime? until,

  /// The caller pays a renewing yearly plan for another household (archived,
  /// left or deleted): deleting the account doesn't cancel it.
  final bool elsewhere = false,

  /// The caller's household has a renewing yearly plan, whoever pays it.
  final bool householdBilled = false,
}) {
  factory parse(Object? json) => switch (json) {
    final Map<String, dynamic> m => MyYearlyPlan(
      subscriber: m['subscriber'] == true,
      renewing: m['renewing'] == true,
      billingIssue: m['billing_issue'] == true,
      until: DateTime.tryParse('${m['until']}'),
      elsewhere: m['elsewhere'] == true,
      householdBilled: m['household_billed'] == true,
    ),
    _ => const MyYearlyPlan(),
  };
}

/// The two server reads the Premium page and the billing warnings make;
/// neither touches a store or RevenueCat.
abstract interface class PremiumServer() {
  /// The server switch `premium_offer` (seeded off): whether Hummlist
  /// Premium may be offered at all. False when it cannot be read.
  Future<bool> offerOpen();

  /// Throws when it cannot be read.
  Future<MyYearlyPlan> myYearlyPlan();
}

class const SupabasePremiumServer(final SupabaseClient _client)
    implements PremiumServer {
  @override
  Future<bool> offerOpen() async {
    try {
      return await _client.rpc<Object?>('premium_offer') == true;
    } on Object {
      return false;
    }
  }

  @override
  Future<MyYearlyPlan> myYearlyPlan() async =>
      MyYearlyPlan.parse(await _client.rpc<Object?>('my_yearly_plan'));
}

/// Apple's subscription settings, for when StoreKit's own sheet is not
/// available (the web, an error).
final appleSubscriptionsUrl = Uri.parse(
  'https://apps.apple.com/account/subscriptions',
);

/// The app's Play package (applicationId on main).
const playPackage = 'com.hummlist.app';

/// Google Play's page for one subscription: `sku` is the subscription's
/// product id, `package` the app's (Play Billing docs, "Deep link to the
/// subscription management page", read 2026-11-01).
final googleSubscriptionUrl = Uri.https(
  'play.google.com',
  '/store/account/subscriptions',
  {'sku': 'com.hummlist.app.yearly', 'package': playPackage},
);

/// Google Play's list of all subscriptions.
final googleSubscriptionsUrl = Uri.parse(
  'https://play.google.com/store/account/subscriptions',
);

/// Apple's standard EULA, linked as the terms of use on iOS until Hummlist
/// has its own (H-93: needs a lawyer; NEEDS_LEAD Job 49).
final appleEulaUrl = Uri.parse(
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
);

/// The terms of use for [platform]: on Android and the web a placeholder,
/// the support page, until Legal Review supplies Hummlist's terms
/// (NEEDS_LEAD Job 49 lists it).
Uri termsUrl(TargetPlatform platform, String language) =>
    platform == TargetPlatform.iOS ? appleEulaUrl : supportUrl(language);
