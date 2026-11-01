/// Whether events from this install, user and household are ours (Peter's
/// family, test accounts, development builds) rather than a customer's.
/// Every gate insight filters `is_internal = true` out (docs/ANALYTICS.md).
///
/// The rules, each enough on its own:
/// - a debug or profile build ([releaseBuild] false);
/// - an install flagged internal under More (long press on the version);
/// - a household listed in the `ANALYTICS_INTERNAL_HOUSEHOLDS` define;
/// - a household with a RevenueCat promotional grant ([testerHousehold]:
///   testers', App and Play Review's free premium; their households never
///   count, as the server's `household_internal` says);
/// - a user whose e-mail domain is a test domain: the reserved top-level
///   domains `.test`, `.invalid`, `.example`, `.localhost` (the fixtures'
///   `fg.test`, `fg-test.invalid`, the e2e `example.test`) and the
///   reserved `example.com/.net/.org`, plus any domain in
///   `ANALYTICS_INTERNAL_EMAIL_DOMAINS`.
///
/// To add a rule, add a parameter here and a case to
/// test/analytics/internal_test.dart. The e-mail is read on the device and
/// never sent.
bool isInternal({
  required bool releaseBuild,
  required bool internalInstall,
  required String? householdId,
  required String? email,
  Set<String> internalHouseholds = const {},
  Set<String> internalEmailDomains = const {},
  String? testerHousehold,
}) =>
    !releaseBuild ||
    internalInstall ||
    (householdId != null && internalHouseholds.contains(householdId)) ||
    (householdId != null && householdId == testerHousehold) ||
    (email != null && _testDomain(email, internalEmailDomains));

const _reservedTopLevel = {'test', 'invalid', 'example', 'localhost'};
const _reservedDomains = {'example.com', 'example.net', 'example.org'};

bool _testDomain(String email, Set<String> extra) {
  final at = email.lastIndexOf('@');
  if (at < 0) {
    return false;
  }
  final domain = email.substring(at + 1).toLowerCase().trim();
  bool listed(String d) => domain == d || domain.endsWith('.$d');
  return _reservedTopLevel.contains(domain.split('.').last) ||
      _reservedDomains.any(listed) ||
      extra.any((d) => listed(d.toLowerCase()));
}

/// A comma-separated define as a set, blanks dropped.
Set<String> csvSet(String csv) => {
  for (final part in csv.split(','))
    if (part.trim().isNotEmpty) part.trim().toLowerCase(),
};
