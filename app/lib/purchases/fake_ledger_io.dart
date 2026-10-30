import 'dart:io';

import 'package:family_groceries/purchases/fake_store.dart';
import 'package:path_provider/path_provider.dart';

FakeLedgerStore fileLedger() => const _FileLedger();

class const _FileLedger() implements FakeLedgerStore {
  static Future<File> _file() async =>
      File('${(await getApplicationSupportDirectory()).path}/fake_store.json');

  @override
  Future<String?> read() async {
    final file = await _file();
    return file.existsSync() ? await file.readAsString() : null;
  }

  @override
  Future<void> write(String contents) async {
    final file = await _file();
    await file.parent.create(recursive: true);
    await file.writeAsString(contents);
  }
}
