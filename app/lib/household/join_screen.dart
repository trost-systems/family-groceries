import 'dart:async';

import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/join_cubit.dart';
import 'package:family_groceries/household/onboarding_page.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Onboarding Step 2b, also for someone in a household (More's "Anderem
/// Haushalt beitreten", or an invite link): enter or keep the code, see
/// the household's name, then join. In a household it first says so and
/// what switching does; Cancel is the prominent answer there.
class const JoinScreen({
  super.key,

  /// The code of the invite link the user came with (`/join/<code>`).
  final String? link,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (context) => JoinCubit(
      context.read<InviteRepository>(),
      context.read<SessionCubit>(),
      pendingInvite: context.read<PendingInvite>(),
      link: link,
    ),
    child: _JoinView(link: link),
  );
}

class const _JoinView({final String? link}) extends StatefulWidget {
  @override
  State<_JoinView> createState() => _JoinViewState();
}

class _JoinViewState() extends State<_JoinView> {
  late final _code = TextEditingController(text: widget.link ?? '');

  @override
  void initState() {
    super.initState();
    if (widget.link case final link?) {
      unawaited(context.read<JoinCubit>().check(link));
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  /// Back to the list, which is Step 1 without a household. The link is
  /// answered.
  void _cancel() {
    context.read<PendingInvite>().clear();
    leaveStep(context);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final current = switch (context.watch<SessionCubit>().state) {
      InHousehold(:final household) => household,
      _ => null,
    };
    return BlocConsumer<JoinCubit, JoinState>(
      listenWhen: (before, now) => now.phase == JoinPhase.joined,
      // To the list, or to the MCP authorization this was on the way to.
      listener: (context, _) => leaveStep(context),
      builder: (context, state) {
        final cubit = context.read<JoinCubit>();
        final previewed =
            state.phase == JoinPhase.previewed ||
            state.phase == JoinPhase.joining;
        final problem = state.problem;
        final join = previewed
            ? (state.busy ? null : () => unawaited(cubit.join()))
            : (state.busy ? null : () => unawaited(cubit.check(_code.text)));
        final joinLabel = Text(
          previewed ? l10n.joinHousehold : l10n.inviteCheck,
        );
        final cancelLabel = Text(l10n.cancel);
        // In a household, joining moves the user: Cancel is the safe,
        // prominent answer, joining the second one.
        final warn = current != null && previewed;
        return OnboardingPage(
          title: current == null
              ? l10n.onboardingJoin
              : l10n.joinOtherHousehold,
          listKey: const ValueKey('join-screen'),
          onBack: _cancel,
          children: [
            if (current != null) ...[
              Card(
                key: const ValueKey('already-in-household'),
                margin: EdgeInsets.zero,
                color: theme.colorScheme.secondaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.alreadyInHousehold,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(switch (state.currentMembers) {
                        1 => l10n.switchHouseholdAlone(current.name),
                        int() => l10n.switchHouseholdShared(current.name),
                        null => l10n.switchHouseholdWarning,
                      }),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
            TextField(
              key: const ValueKey('invite-code'),
              controller: _code,
              enabled: !state.busy,
              autofocus: widget.link == null,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              enableSuggestions: false,
              decoration: InputDecoration(labelText: l10n.inviteCode),
              onChanged: cubit.edited,
              onSubmitted: (_) => join?.call(),
            ),
            if (previewed && state.household != null) ...[
              const SizedBox(height: 16),
              Card.outlined(
                key: const ValueKey('invite-household'),
                margin: EdgeInsets.zero,
                child: ListTile(
                  leading: const Icon(Icons.home_outlined),
                  title: Text(l10n.invitePreview),
                  subtitle: Text(
                    state.household!,
                    style: theme.textTheme.titleLarge,
                  ),
                ),
              ),
            ],
            if (problem != null)
              ProblemText(
                householdProblemText(l10n, problem),
                key: const ValueKey('join-problem'),
              ),
            if (state.busy) ...[
              const SizedBox(height: 16),
              const Center(child: CircularProgressIndicator()),
            ],
            const SizedBox(height: 24),
            if (warn) ...[
              FilledButton(
                key: const ValueKey('join-cancel'),
                onPressed: _cancel,
                child: cancelLabel,
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                key: const ValueKey('join-confirm'),
                onPressed: join,
                child: joinLabel,
              ),
            ] else ...[
              FilledButton(
                key: ValueKey(previewed ? 'join-confirm' : 'invite-check'),
                onPressed: join,
                child: joinLabel,
              ),
              const SizedBox(height: 8),
              TextButton(
                key: const ValueKey('join-cancel'),
                onPressed: _cancel,
                child: cancelLabel,
              ),
            ],
          ],
        );
      },
    );
  }
}
