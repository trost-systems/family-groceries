import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';

import 'support.dart';

void main() {
  setUpAll(loadFonts);

  group('HexButton', () {
    testWidgets('announces a labelled, enabled button', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpHex(tester, HexButton(label: 'Speichern', onPressed: () {}));
      expect(
        tester.getSemantics(find.byType(HexButton)),
        isSemantics(
          label: 'Speichern',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          isFocusable: true,
          hasTapAction: true,
        ),
      );
      semantics.dispose();
    });

    testWidgets('a tap calls onPressed once', (tester) async {
      var presses = 0;
      await pumpHex(
        tester,
        HexButton(label: 'Speichern', onPressed: () => presses++),
      );
      await tester.tap(find.byType(HexButton));
      await tester.pumpAndSettle();
      expect(presses, 1);
    });

    testWidgets('Enter and Space activate the focused button', (tester) async {
      var presses = 0;
      final focus = FocusNode();
      addTearDown(focus.dispose);
      await pumpHex(
        tester,
        HexButton(
          label: 'Speichern',
          focusNode: focus,
          onPressed: () => presses++,
        ),
      );
      focus.requestFocus();
      await tester.pump();
      await pressKey(tester, LogicalKeyboardKey.enter);
      expect(presses, 1);
      await pressKey(tester, LogicalKeyboardKey.space);
      expect(presses, 2);
    });

    testWidgets('a disabled button ignores taps and keys', (tester) async {
      final semantics = tester.ensureSemantics();
      final focus = FocusNode();
      addTearDown(focus.dispose);
      await pumpHex(
        tester,
        HexButton(label: 'Senden', focusNode: focus, onPressed: null),
      );
      focus.requestFocus();
      await tester.pump();
      expect(focus.hasFocus, isFalse);
      await tester.tap(find.byType(HexButton), warnIfMissed: false);
      await pressKey(tester, LogicalKeyboardKey.enter);
      expect(
        tester.getSemantics(find.byType(HexButton)),
        isSemantics(
          label: 'Senden',
          isButton: true,
          hasEnabledState: true,
          isEnabled: false,
          hasTapAction: false,
        ),
      );
      semantics.dispose();
    });

    testWidgets('a disabled button never calls back', (tester) async {
      var presses = 0;
      var enabled = true;
      late StateSetter setState;
      await pumpHex(
        tester,
        StatefulBuilder(
          builder: (context, set) {
            setState = set;
            return HexButton(
              label: 'Senden',
              onPressed: enabled ? () => presses++ : null,
            );
          },
        ),
      );
      await tester.tap(find.byType(HexButton));
      expect(presses, 1);
      setState(() => enabled = false);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(HexButton), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(presses, 1);
    });

    testWidgets('pressing sinks the face by depth.press and release '
        'brings it back', (tester) async {
      await pumpHex(tester, HexButton(label: 'Speichern', onPressed: () {}));
      final button = find.byType(HexButton);
      final rest = faceRect(tester, button, HexButton.faceKey);
      final gesture = await tester.startGesture(tester.getCenter(button));
      await tester.pumpAndSettle();
      final pressed = faceRect(tester, button, HexButton.faceKey);
      expect(pressed.top - rest.top, HexDepth.press);
      expect(pressed.size, rest.size);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(faceRect(tester, button, HexButton.faceKey), rest);
    });

    testWidgets('the press takes motion.duration.press', (tester) async {
      await pumpHex(tester, HexButton(label: 'Speichern', onPressed: () {}));
      final button = find.byType(HexButton);
      final rest = faceRect(tester, button, HexButton.faceKey);
      final gesture = await tester.startGesture(tester.getCenter(button));
      await tester.pump();
      await tester.pump(HexDuration.press ~/ 2);
      final halfway = faceRect(tester, button, HexButton.faceKey).top;
      expect(halfway, greaterThan(rest.top));
      expect(halfway, lessThan(rest.top + HexDepth.press));
      await tester.pump(HexDuration.press ~/ 2);
      expect(
        faceRect(tester, button, HexButton.faceKey).top,
        rest.top + HexDepth.press,
      );
      await gesture.up();
      await tester.pumpAndSettle();
    });

    testWidgets('hovering lifts the face by depth.lift', (tester) async {
      await pumpHex(tester, HexButton(label: 'Speichern', onPressed: () {}));
      final button = find.byType(HexButton);
      final rest = faceRect(tester, button, HexButton.faceKey);
      final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
      addTearDown(mouse.removePointer);
      await mouse.addPointer(location: Offset.zero);
      await mouse.moveTo(tester.getCenter(button));
      await tester.pumpAndSettle();
      expect(
        rest.top - faceRect(tester, button, HexButton.faceKey).top,
        HexDepth.lift,
      );
      await mouse.moveTo(Offset.zero);
      await tester.pumpAndSettle();
      expect(faceRect(tester, button, HexButton.faceKey), rest);
    });

    testWidgets('with reduced motion the face moves without animation frames', (
      tester,
    ) async {
      await pumpHex(
        tester,
        HexButton(label: 'Speichern', onPressed: () {}),
        disableAnimations: true,
      );
      final button = find.byType(HexButton);
      final rest = faceRect(tester, button, HexButton.faceKey);
      final gesture = await tester.startGesture(tester.getCenter(button));
      await tester.pump();
      expect(
        faceRect(tester, button, HexButton.faceKey).top,
        rest.top + HexDepth.press,
      );
      expect(tester.binding.hasScheduledFrame, isFalse);
      await gesture.up();
      await tester.pump();
      expect(faceRect(tester, button, HexButton.faceKey), rest);
      expect(tester.binding.hasScheduledFrame, isFalse);
    });

    testWidgets('without reduced motion the press animates over frames', (
      tester,
    ) async {
      await pumpHex(tester, HexButton(label: 'Speichern', onPressed: () {}));
      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(HexButton)),
      );
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue);
      await gesture.up();
      await tester.pumpAndSettle();
    });

    testWidgets('a short label still gets a 48 x 48 tap target', (
      tester,
    ) async {
      await pumpHex(
        tester,
        HexButton(label: 'OK', size: HexButtonSize.small, onPressed: () {}),
      );
      final size = tester.getSize(find.byType(HexButton));
      expect(size.width, greaterThanOrEqualTo(48));
      expect(size.height, greaterThanOrEqualTo(48));
    });

    testWidgets('the label sits between the hex tips', (tester) async {
      await pumpHex(tester, HexButton(label: 'Speichern', onPressed: () {}));
      final face = faceRect(tester, find.byType(HexButton), HexButton.faceKey);
      final text = tester.getRect(find.text('Speichern'));
      final tip = HexShapeTokens.sharp.tip * face.height;
      expect(text.left, greaterThanOrEqualTo(face.left + tip));
      expect(text.right, lessThanOrEqualTo(face.right - tip));
    });
  });

  group('HexChip', () {
    testWidgets('announces its selection and toggles it', (tester) async {
      final semantics = tester.ensureSemantics();
      bool? next;
      await pumpHex(
        tester,
        HexChip(label: 'Edeka', selected: true, onSelected: (v) => next = v),
      );
      expect(
        tester.getSemantics(find.byType(HexChip)),
        isSemantics(
          label: 'Edeka',
          isButton: true,
          hasSelectedState: true,
          isSelected: true,
          hasTapAction: true,
        ),
      );
      await tester.tap(find.byType(HexChip));
      expect(next, isFalse);
      semantics.dispose();
    });

    testWidgets('a selected chip stays sunk into its edge', (tester) async {
      Future<Rect> faceOf({required bool selected}) async {
        await pumpHex(
          tester,
          HexChip(label: 'Lidl', selected: selected, onSelected: (_) {}),
        );
        return faceRect(tester, find.byType(HexChip), HexChip.faceKey);
      }

      final unselected = await faceOf(selected: false);
      final selected = await faceOf(selected: true);
      expect(selected.top - unselected.top, HexDepth.press);
    });
  });

  group('ListRow', () {
    testWidgets('announces title, subtitle, store and checked state', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      var checked = false;
      await pumpHex(
        tester,
        StatefulBuilder(
          builder: (context, setState) => ListRow(
            title: 'Hafermilch',
            subtitle: '2 Liter',
            store: 'Edeka',
            checked: checked,
            onChanged: (v) => setState(() => checked = v),
          ),
        ),
      );
      expect(
        tester.getSemantics(find.byType(ListRow)),
        isSemantics(
          label: 'Hafermilch, 2 Liter, Edeka',
          hasCheckedState: true,
          isChecked: false,
          hasTapAction: true,
        ),
      );
      await tester.tap(find.byType(ListRow));
      await tester.pumpAndSettle();
      expect(
        tester.getSemantics(find.byType(ListRow)),
        isSemantics(hasCheckedState: true, isChecked: true),
      );
      semantics.dispose();
    });

    testWidgets('Space toggles the focused row', (tester) async {
      final focus = FocusNode();
      addTearDown(focus.dispose);
      final changes = <bool>[];
      await pumpHex(
        tester,
        ListRow(
          title: 'Brot',
          quantity: '1',
          checked: false,
          focusNode: focus,
          onChanged: changes.add,
        ),
      );
      focus.requestFocus();
      await tester.pump();
      await pressKey(tester, LogicalKeyboardKey.space);
      expect(changes, [true]);
    });

    testWidgets('is at least 48 dp tall', (tester) async {
      await pumpHex(
        tester,
        ListRow(title: 'Brot', checked: false, onChanged: (_) {}),
      );
      expect(
        tester.getSize(find.byType(ListRow)).height,
        greaterThanOrEqualTo(48),
      );
    });
  });

  group('accessibility guidelines, whole gallery panel', () {
    for (final theme in allThemes) {
      testWidgets(themeName(theme), (tester) async {
        final semantics = tester.ensureSemantics();
        await pumpHex(
          tester,
          GalleryPanel(theme: theme),
          theme: theme,
          size: const Size(420, 1000),
        );
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        semantics.dispose();
      });
    }
  });
}
