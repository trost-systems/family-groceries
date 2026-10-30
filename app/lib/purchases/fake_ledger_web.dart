import 'package:family_groceries/purchases/fake_store.dart';

/// The web app never sells, fake or not; this only compiles.
FakeLedgerStore fileLedger() => _NoLedger();

class _NoLedger() implements FakeLedgerStore {
  String? _contents;

  @override
  Future<String?> read() async => _contents;

  @override
  Future<void> write(String contents) async => _contents = contents;
}
