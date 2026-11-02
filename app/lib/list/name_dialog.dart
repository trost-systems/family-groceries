import 'dart:async';

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// Asks for a name and hands it to [save], trimmed. The dialog stays open
/// while [save] runs and when it answers false (a name taken, offline), so
/// the name can be fixed. An empty name closes it without saving.
Future<void> showNameDialog(
  BuildContext context, {
  required String title,
  required String confirm,
  required String label,
  required Future<bool> Function(String name) save,
  String initial = '',
  int maxLength = 60,
}) => showDialog<void>(
  context: context,
  builder: (_) => _NameDialog(
    title: title,
    confirm: confirm,
    label: label,
    save: save,
    initial: initial,
    maxLength: maxLength,
  ),
);

class const _NameDialog({
  required final String title,
  required final String confirm,
  required final String label,
  required final Future<bool> Function(String name) save,
  required final String initial,
  required final int maxLength,
}) extends StatefulWidget {
  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState() extends State<_NameDialog> {
  late final _name = TextEditingController(text: widget.initial);
  var _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) {
      return;
    }
    final name = _name.text.trim();
    if (name.isEmpty) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _busy = true);
    final saved = await widget.save(name);
    if (!mounted) {
      return;
    }
    if (saved) {
      Navigator.of(context).pop();
    } else {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        key: const ValueKey('name-dialog-field'),
        controller: _name,
        autofocus: true,
        readOnly: _busy,
        maxLength: widget.maxLength,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(labelText: widget.label),
        onSubmitted: (_) => unawaited(_submit()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          key: const ValueKey('name-dialog-confirm'),
          onPressed: _busy ? null : () => unawaited(_submit()),
          child: Text(widget.confirm),
        ),
      ],
    );
  }
}
