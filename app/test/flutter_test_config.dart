import 'dart:async';

import 'package:family_groceries/purchases/paywall_prototypes.dart';

/// Runs before every test file: debug-only switches stay out of other tests'
/// widget trees and screenshots.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  showPaywallPrototypeSwitch = false;
  await testMain();
}
