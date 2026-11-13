import 'package:flutter/widgets.dart';
import 'package:marionette_flutter/marionette_flutter.dart';
import 'package:material_ui/material_ui.dart' as material;

/// Marionette's own list of interactive widgets names Flutter's in-framework
/// Material classes. Since Flutter 3.50 the app's come from material_ui
/// (job 201), other types, so `fg find` and every `--row` command saw none
/// of its buttons, fields or checkboxes. This is the same list from
/// material_ui.
const materialUiConfiguration = MarionetteConfiguration(
  isInteractiveElement: _isInteractive,
  shouldStopTraversalAtElement: _isStop,
  extractText: _text,
);

bool _isInteractive(Element element) => switch (element.widget) {
  material.Checkbox() ||
  material.CheckboxListTile() ||
  material.DropdownButton() ||
  material.DropdownButtonFormField() ||
  material.FloatingActionButton() ||
  material.IconButton() ||
  material.InkWell() ||
  material.PopupMenuButton() ||
  material.Radio() ||
  material.RadioListTile() ||
  material.Slider() ||
  material.Switch() ||
  material.SwitchListTile() ||
  material.TextField() ||
  material.TextFormField() ||
  material.ButtonStyleButton() => true,
  _ => false,
};

/// Like marionette's own rule: the search goes on below the widgets that
/// wrap content or show their value in a child.
bool _isStop(Element element) => switch (element.widget) {
  material.InkWell() ||
  material.DropdownButton() ||
  material.DropdownButtonFormField() ||
  material.PopupMenuButton() ||
  material.RadioListTile() => false,
  _ => _isInteractive(element),
};

String? _text(Element element) => switch (element.widget) {
  material.TextField(:final controller) => controller?.text,
  material.TextFormField(:final controller) => controller?.text,
  _ => null,
};
