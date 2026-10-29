import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// The temporary card at the top that names the gestures, until dismissed.
class const ExplainerCard({required final VoidCallback onDismiss, super.key})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Container(
      key: const ValueKey('list-hint'),
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: BoxDecoration(
        color: scheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        spacing: 10,
        children: [
          const ExcludeSemantics(
            child: Text('👆', style: TextStyle(fontSize: 18)),
          ),
          Expanded(
            child: Text(
              l10n.listHint,
              style: TextStyle(
                fontSize: 13,
                height: 1.35,
                color: scheme.onTertiaryContainer,
              ),
            ),
          ),
          TextButton(
            key: const ValueKey('list-hint-dismiss'),
            onPressed: onDismiss,
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 44),
              foregroundColor: scheme.onTertiaryContainer,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
              textStyle: const TextStyle(fontWeight: FontWeight.w700),
            ),
            child: Text(l10n.listHintDismiss),
          ),
        ],
      ),
    );
  }
}

/// A basket over the empty list's text.
class const EmptyList({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      key: const ValueKey('list-empty'),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 80),
      child: Column(
        spacing: 12,
        children: [
          const ExcludeSemantics(
            child: Text('🧺', style: TextStyle(fontSize: 56)),
          ),
          Text(
            AppLocalizations.of(context).emptyList,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
