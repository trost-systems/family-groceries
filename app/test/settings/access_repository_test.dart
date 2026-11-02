import 'package:family_groceries/settings/access_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  AccessToken row(String kind, [List<String>? scopes]) => AccessToken.fromJson({
    'id': 't1',
    'name': 'Home Assistant',
    'kind': kind,
    'scopes': scopes,
    'token_hint': '1234',
    'created_at': '2026-11-02T10:00:00Z',
    'last_used_at': null,
  });

  test('an API key carries its scopes', () {
    final read = row('api', ['read']);
    expect(read.kind, AccessKind.api);
    expect(read.scopes, ApiScopes.read);
    expect(row('api', ['read', 'write']).scopes, ApiScopes.readWrite);
    expect(row('api', ['write', 'read']).scopes, ApiScopes.readWrite);
  });

  test('MCP tokens and Siri credentials have no scopes', () {
    expect(row('pat').kind, AccessKind.pat);
    expect(row('pat').scopes, isNull);
    expect(row('siri').kind, AccessKind.siri);
    expect(row('siri').scopes, isNull);
  });

  test('the scopes go to the server as it names them', () {
    expect(ApiScopes.read.wire, ['read']);
    expect(ApiScopes.readWrite.wire, ['read', 'write']);
  });
}
