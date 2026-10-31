import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

final forbidden = RegExp(
  r'''^\s*(import|export)\s+['"]package:flutter/(material|cupertino)\.dart''',
  multiLine: true,
);

void main() {
  test('no file in lib/ or test/ imports material or cupertino', () {
    final offenders = [
      for (final dir in ['lib', 'test'])
        for (final file in Directory(dir).listSync(recursive: true))
          if (file is File &&
              file.path.endsWith('.dart') &&
              forbidden.hasMatch(file.readAsStringSync()))
            file.path,
    ];
    expect(offenders, isEmpty);
  });

  test('the pattern catches a material import', () {
    expect(
      forbidden.hasMatch("import 'package:flutter/material.dart';"),
      isTrue,
    );
    expect(
      forbidden.hasMatch("import 'package:flutter/cupertino.dart';"),
      isTrue,
    );
    expect(
      forbidden.hasMatch("import 'package:flutter/widgets.dart';"),
      isFalse,
    );
  });
}
