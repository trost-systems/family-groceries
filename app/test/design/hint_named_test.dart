import 'package:family_groceries/design/field_border.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  testWidgets('a hint-only field is named by its hint, once, empty or not', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HintNamed(
            controller: controller,
            hint: 'Was brauchst du?',
            field: TextField(
              autofillHints: null,
              controller: controller,
              decoration: const InputDecoration(hintText: 'Was brauchst du?'),
            ),
          ),
        ),
      ),
    );
    SemanticsNode field() => tester.getSemantics(find.byType(EditableText));

    expect(field().label, 'Was brauchst du?');
    await tester.enterText(find.byType(TextField), 'Milch');
    await tester.pumpAndSettle();
    expect(field().label, 'Was brauchst du?');
    expect(field().value, 'Milch');
    await tester.enterText(find.byType(TextField), '');
    await tester.pumpAndSettle();
    expect(field().label, 'Was brauchst du?');
    handle.dispose();
  });
}
