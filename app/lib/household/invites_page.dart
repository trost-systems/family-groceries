import 'dart:async';

import 'package:family_groceries/household/invite_repository.dart';
import 'package:family_groceries/household/invite_share.dart';
import 'package:family_groceries/household/invites_cubit.dart';
import 'package:family_groceries/household/onboarding_page.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// More's Einladungen (`/more/invites`): invite the partner (a new invite,
/// shared like in onboarding's Step 3), and the open invites with how long
/// each is valid; any member revokes one. Used, revoked and expired
/// invites are not listed.
class const InvitesPage({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      switch (context.watch<SessionCubit>().state) {
        InHousehold(:final household) => BlocProvider(
          // A new household (a switch) lists its own invites.
          key: ValueKey(household.id),
          create: (_) =>
              InvitesCubit(context.read<InviteRepository>(), household.id),
          child: const _InvitesView(),
        ),
        _ => const SizedBox.shrink(),
      };
}

class const _InvitesView() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final cubit = context.read<InvitesCubit>();
    final state = context.watch<InvitesCubit>().state;
    final invites = state.invites;
    final problem = state.problem;
    return RefreshIndicator(
      onRefresh: cubit.reload,
      child: ListView(
        key: const ValueKey('invites-page'),
        padding: const EdgeInsets.all(24),
        children: [
          Text(l10n.invitePartnerBody),
          const SizedBox(height: 16),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: FilledButton.icon(
              key: const ValueKey('invite-new'),
              icon: const Icon(Icons.person_add_outlined),
              label: Text(l10n.newInvite),
              onPressed: state.busy ? null : () => unawaited(_create(context)),
            ),
          ),
          if (problem != null)
            ProblemText(
              householdProblemText(l10n, problem),
              key: const ValueKey('invites-problem'),
            ),
          const SizedBox(height: 24),
          Semantics(
            header: true,
            child: Text(l10n.invitesOpen, style: theme.textTheme.titleMedium),
          ),
          const SizedBox(height: 12),
          if (invites == null)
            const Center(child: CircularProgressIndicator())
          else if (invites.isEmpty)
            Text(l10n.invitesEmpty, key: const ValueKey('invites-empty'))
          else
            for (final invite in invites) ...[
              InviteCard(
                invite: invite,
                origin: InviteContext.settings,
                onRevoke: state.busy
                    ? null
                    : () => unawaited(_revoke(context, invite)),
              ),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }

  /// Like Step 3: the apps open the share sheet once the invite exists.
  static Future<void> _create(BuildContext page) async {
    final invite = await page.read<InvitesCubit>().create();
    if (invite != null &&
        !kIsWeb &&
        page.mounted &&
        page.read<InviteSharer>().canShare) {
      await shareInvite(page, invite.code, InviteContext.settings);
    }
  }

  static Future<void> _revoke(BuildContext page, Invite invite) async {
    final l10n = AppLocalizations.of(page);
    final messenger = ScaffoldMessenger.of(page);
    if (await page.read<InvitesCubit>().revoke(invite)) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.inviteRevoked)));
    }
  }
}
