import 'dart:async';

import 'package:family_groceries/app/environment.dart';
import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/join_cubit.dart';
import 'package:family_groceries/household/onboarding_page.dart';
import 'package:family_groceries/household/pending_invite.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/purchases/refund_help.dart';
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

  /// The last member of an unlocked household may archive it (job 43).
  final bool archiveOffered = Environment.householdArchive,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (context) => JoinCubit(
      context.read<InviteRepository>(),
      context.read<SessionCubit>(),
      pendingInvite: context.read<PendingInvite>(),
      link: link,
    ),
    child: _JoinView(link: link, archiveOffered: archiveOffered),
  );
}

class const _JoinView({final String? link, final bool archiveOffered = false})
    extends StatefulWidget {
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

  /// Declining the archive: the household and its Lifetime go, with no
  /// refund. The user says so once more; it never stops them.
  Future<void> _confirmDelete(String household) async {
    final l10n = AppLocalizations.of(context);
    final cubit = context.read<JoinCubit>();
    final delete = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        key: const ValueKey('join-delete-dialog'),
        title: Text(l10n.joinDeleteTitle(household)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.joinLifetimeEnds(household)),
            RefundHelpLink(
              key: const ValueKey('join-delete-refund-help'),
              label: l10n.joinLifetimeRefundLink,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            key: const ValueKey('join-delete-confirm'),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.joinDelete),
          ),
        ],
      ),
    );
    if (delete ?? false) {
      await cubit.join();
    }
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
        final lifetime = state.lifetime;
        final endsLifetime =
            previewed && current != null && lifetime.leavesUnlocked;
        // Joining ends the current household's Lifetime: the button says
        // that the user goes ahead anyway; it never stops them.
        final joinLabel = Text(
          !previewed
              ? l10n.inviteCheck
              : endsLifetime
              ? l10n.joinAnyway
              : l10n.joinHousehold,
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
                      // With Lifetime at stake the card below says what
                      // happens to the household instead.
                      if (!endsLifetime) ...[
                        const SizedBox(height: 8),
                        Text(switch (state.currentMembers) {
                          1 => l10n.switchHouseholdAlone(current.name),
                          int() => l10n.switchHouseholdShared(current.name),
                          null => l10n.switchHouseholdWarning,
                        }),
                      ],
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
              if (lifetime.targetUnlocked) ...[
                const SizedBox(height: 8),
                Semantics(
                  container: true,
                  child: ListTile(
                    key: const ValueKey('join-target-unlocked'),
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.check_circle,
                      color: theme.colorScheme.primary,
                    ),
                    title: Text(l10n.joinTargetUnlocked),
                  ),
                ),
              ],
              if (lifetime.refundHelp)
                RefundHelpLink(
                  key: const ValueKey('join-refund-help'),
                  label: l10n.joinRefundLink,
                ),
              if (current != null && lifetime.leavesUnlocked) ...[
                const SizedBox(height: 16),
                if (widget.archiveOffered)
                  _Warning(
                    'join-archive-offer',
                    l10n.joinArchiveOffer(current.name),
                    error: false,
                  )
                else ...[
                  _Warning(
                    'join-lifetime-ends',
                    l10n.joinLifetimeEnds(current.name),
                  ),
                  RefundHelpLink(
                    key: const ValueKey('join-lifetime-refund-help'),
                    label: l10n.joinLifetimeRefundLink,
                  ),
                ],
              ],
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
            if (endsLifetime && widget.archiveOffered) ...[
              FilledButton(
                key: const ValueKey('join-cancel'),
                onPressed: _cancel,
                child: cancelLabel,
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                key: const ValueKey('join-archive'),
                onPressed: state.busy
                    ? null
                    : () => unawaited(cubit.join(archive: true)),
                child: Text(l10n.joinArchive),
              ),
              const SizedBox(height: 8),
              TextButton(
                key: const ValueKey('join-delete'),
                onPressed: state.busy
                    ? null
                    : () => unawaited(_confirmDelete(current.name)),
                child: Text(l10n.joinDelete),
              ),
            ] else if (warn) ...[
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

/// A highlighted note about what joining does to the current household.
class const _Warning(
  final String id,
  final String text, {
  final bool error = true,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      key: ValueKey(id),
      margin: EdgeInsets.zero,
      color: error ? scheme.errorContainer : scheme.tertiaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          text,
          style: TextStyle(
            color: error ? scheme.onErrorContainer : scheme.onTertiaryContainer,
          ),
        ),
      ),
    );
  }
}
