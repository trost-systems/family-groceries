import 'dart:async';

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/settings/account_repository.dart';
import 'package:family_groceries/settings/delete_account_dialog.dart';
import 'package:family_groceries/settings/export_saver.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Who is signed in, exporting the account's data and deleting the account
/// (`/more/account`). A page of the More tab, which gives it its frame.
class const AccountScreen({
  super.key,

  /// Overrides the platform's download or share sheet, for tests.
  final ExportSaver saveExport = platformSaveExport,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final email = context.read<AccountRepository>().email;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: ListView(
          key: const ValueKey('account-screen'),
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            if (email != null)
              ListTile(
                key: const ValueKey('account-email'),
                leading: const Icon(Icons.account_circle_outlined),
                title: SelectionArea(child: Text(email)),
              ),
            Builder(
              builder: (tile) => ListTile(
                key: const ValueKey('account-export'),
                leading: const Icon(Icons.download),
                title: Text(l10n.accountExport),
                subtitle: Text(l10n.accountExportBody),
                onTap: () => unawaited(_export(tile, saveExport)),
              ),
            ),
            ListTile(
              key: const ValueKey('account-delete'),
              leading: const Icon(Icons.delete_forever),
              iconColor: Theme.of(context).colorScheme.error,
              textColor: Theme.of(context).colorScheme.error,
              title: Text(l10n.accountDelete),
              onTap: () => unawaited(deleteAccount(context)),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _export(BuildContext tile, ExportSaver save) async {
  final l10n = AppLocalizations.of(tile);
  final messenger = ScaffoldMessenger.of(tile);
  final box = tile.findRenderObject() as RenderBox?;
  final origin = box == null ? null : box.localToGlobal(Offset.zero) & box.size;
  final message = await () async {
    try {
      final json = await tile.read<AccountRepository>().export();
      final path = await save(
        exportFileName(DateTime.now()),
        json,
        origin: origin,
      );
      return path == null ? l10n.exportDone : l10n.exportDoneAt(path);
    } on AccountError catch (e) {
      return switch (e) {
        AccountOffline() => l10n.exportOffline,
        AccountFailed(:final code) => l10n.exportFailed(code),
        AppleReauthCanceled() => l10n.exportFailed('canceled'),
      };
    }
  }();
  messenger.showSnackBar(SnackBar(content: Text(message)));
}
