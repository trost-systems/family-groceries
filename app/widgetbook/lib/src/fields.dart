import 'package:family_groceries/design/field_border.dart';
import 'package:flutter/material.dart';
import 'package:hummlist_widgetbook/src/story.dart';

const _path = 'Hummlist/Felder';

/// Text fields through the app theme: single-line fields are hexes,
/// multi-line ones keep the rounded contour.
final fieldComponents = [
  component(_path, 'Textfeld', [
    plain('Ruhe', (context) => const _Field()),
    plain('Fokus', (context) => const _Field(autofocus: true, text: 'Lidl')),
    plain(
      'Fehler',
      (context) => const _Field(text: 'peter', error: 'Keine gültige E-Mail'),
    ),
    plain('Aus', (context) => const _Field(enabled: false)),
    plain('Nur Hinweis', (context) => const _Field(label: null)),
    plain('Mehrzeilig', (context) => const _Field(multiline: true)),
  ]),
];

class const _Field({
  final String? label = 'E-Mail',
  final String? text,
  final String? error,
  final bool autofocus = false,
  final bool enabled = true,
  final bool multiline = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final field = TextField(
      controller: TextEditingController(text: text),
      autofocus: autofocus,
      enabled: enabled,
      minLines: multiline ? 4 : 1,
      maxLines: multiline ? 8 : 1,
      decoration: InputDecoration(
        labelText: multiline ? 'Nachricht' : label,
        hintText: label == null ? 'Was brauchst du?' : null,
        alignLabelWithHint: multiline,
        errorText: error,
      ),
    );
    return SizedBox(
      width: 320,
      child: multiline ? RoundedFields(child: field) : field,
    );
  }
}
