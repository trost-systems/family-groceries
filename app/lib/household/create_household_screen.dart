import 'dart:async';

import 'package:family_groceries/design/hex_radio.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/onboarding_page.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// The longest household name, in characters (code points, as Postgres'
/// char_length counts them).
const maxHouseholdName = 80;

/// Whether [name] is a household name the server takes: 1 to 80
/// characters once trimmed.
bool validHouseholdName(String name) {
  final length = name.trim().runes.length;
  return length >= 1 && length <= maxHouseholdName;
}

/// Onboarding Step 2a: the household's name (prefilled, editable) and
/// whether it starts with the default German stores. Once the server has
/// created it the router moves on to Step 3, inviting the partner. A
/// second tap while creating does nothing; a retry after a lost answer
/// finds the household and goes on (no second one).
class const CreateHouseholdScreen({super.key}) extends StatefulWidget {
  @override
  State<CreateHouseholdScreen> createState() => _CreateHouseholdScreenState();
}

class _CreateHouseholdScreenState() extends State<CreateHouseholdScreen> {
  late final _name = TextEditingController(
    text: AppLocalizations.of(context).householdNameDefault,
  );
  var _defaultStores = true;
  var _busy = false;
  var _invalidName = false;
  HouseholdProblem? _problem;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_busy) {
      return;
    }
    final name = _name.text.trim();
    if (!validHouseholdName(name)) {
      setState(() => _invalidName = true);
      return;
    }
    final session = context.read<SessionCubit>();
    setState(() {
      _busy = true;
      _invalidName = false;
      _problem = null;
    });
    try {
      await session.createHousehold(name, defaultStores: _defaultStores);
    } on HouseholdError catch (e) {
      if (mounted) {
        setState(() => _problem = e.problem);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final problem = _problem;
    return OnboardingPage(
      title: l10n.createHousehold,
      listKey: const ValueKey('create-household-screen'),
      onBack: _busy ? null : () => leaveStep(context),
      children: [
        TextField(
          key: const ValueKey('household-name'),
          controller: _name,
          enabled: !_busy,
          maxLength: maxHouseholdName,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(
            labelText: l10n.householdName,
            errorText: _invalidName ? l10n.householdNameInvalid : null,
          ),
          onSubmitted: (_) => unawaited(_create()),
        ),
        const SizedBox(height: 16),
        Text(l10n.storesChoice, style: theme.textTheme.titleSmall),
        RadioGroup<bool>(
          groupValue: _defaultStores,
          onChanged: (value) {
            if (!_busy && value != null) {
              setState(() => _defaultStores = value);
            }
          },
          child: Column(
            children: [
              HexRadioTile<bool>(
                key: const ValueKey('default-stores'),
                value: true,
                title: Text(l10n.defaultStores),
                subtitle: Text(l10n.defaultStoresHint),
              ),
              HexRadioTile<bool>(
                key: const ValueKey('skip-stores'),
                value: false,
                title: Text(l10n.skipStores),
                subtitle: Text(l10n.skipStoresHint),
              ),
            ],
          ),
        ),
        if (problem != null)
          ProblemText(
            householdProblemText(l10n, problem),
            key: const ValueKey('create-problem'),
          ),
        const SizedBox(height: 24),
        FilledButton(
          key: const ValueKey('create-household'),
          onPressed: _busy ? null : () => unawaited(_create()),
          child: _busy
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n.createHousehold),
        ),
      ],
    );
  }
}
