import 'package:family_groceries/analytics/internal.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  bool internal({
    bool release = true,
    bool install = false,
    String? household,
    String? email,
    Set<String> households = const {},
    Set<String> domains = const {},
  }) => isInternal(
    releaseBuild: release,
    internalInstall: install,
    householdId: household,
    email: email,
    internalHouseholds: households,
    internalEmailDomains: domains,
  );

  test('a customer is not internal', () {
    expect(internal(email: 'anna@gmail.com', household: 'h1'), isFalse);
    expect(internal(email: 'anna@test.de'), isFalse);
    expect(internal(email: 'anna@invalid.com'), isFalse);
    expect(internal(), isFalse);
  });

  test('debug and profile builds are internal', () {
    expect(internal(release: false, email: 'anna@gmail.com'), isTrue);
  });

  test('an internal install is internal', () {
    expect(internal(install: true), isTrue);
  });

  test('listed households are internal', () {
    expect(internal(household: 'h1', households: {'h1'}), isTrue);
    expect(internal(household: 'h2', households: {'h1'}), isFalse);
  });

  test('test domains are internal', () {
    for (final email in [
      'peter@fg.test',
      'Lea@FG-TEST.invalid',
      'e2e-1@example.test',
      'x@sub.example.com',
      'x@example.org',
      'x@localhost',
    ]) {
      expect(internal(email: email), isTrue, reason: email);
    }
  });

  test('extra domains count with their subdomains', () {
    expect(
      internal(email: 'p@petertrost.com', domains: {'petertrost.com'}),
      isTrue,
    );
    expect(
      internal(email: 'p@mail.petertrost.com', domains: {'petertrost.com'}),
      isTrue,
    );
    expect(
      internal(email: 'p@notpetertrost.com', domains: {'petertrost.com'}),
      isFalse,
    );
  });

  test('csvSet trims, lower-cases and drops blanks', () {
    expect(csvSet(' A, b ,,'), {'a', 'b'});
    expect(csvSet(''), isEmpty);
  });
}
