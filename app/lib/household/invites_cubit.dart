import 'dart:async';

import 'package:family_groceries/household/invite_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

@immutable
class const InvitesState({
  /// The open invites, newest first; null until loaded.
  final List<Invite>? invites,

  /// Creating or revoking one: the buttons wait.
  final bool busy = false,
  final HouseholdProblem? problem,
});

/// The open invites of one household: Step 3 makes the first, More's
/// Einladungen lists them, makes more and revokes. Used, revoked and expired
/// invites are not listed.
class InvitesCubit(
  final InviteRepository _repository,
  final String _householdId, {

  /// Step 3 starts empty and makes one on the user's tap; More lists.
  final bool load = true,
}) extends Cubit<InvitesState> {
  this : super(InvitesState(invites: load ? null : const [])) {
    if (load) {
      unawaited(reload());
    }
  }

  Future<void> reload() async {
    try {
      final invites = await _repository.open(_householdId);
      if (!isClosed) {
        emit(InvitesState(invites: invites));
      }
    } on HouseholdError catch (e) {
      if (!isClosed) {
        emit(InvitesState(invites: state.invites, problem: e.problem));
      }
    }
  }

  /// Makes a new invite and puts it first; null when it failed (the state
  /// says why) or another call is running (a double tap).
  Future<Invite?> create() async {
    if (state.busy) {
      return null;
    }
    emit(InvitesState(invites: state.invites, busy: true));
    try {
      final invite = await _repository.create(_householdId);
      if (!isClosed) {
        emit(InvitesState(invites: [invite, ...?state.invites]));
      }
      return invite;
    } on HouseholdError catch (e) {
      if (!isClosed) {
        emit(InvitesState(invites: state.invites, problem: e.problem));
      }
      return null;
    }
  }

  /// Revokes [invite]: its link and code stop working at once. True once
  /// the server took it.
  Future<bool> revoke(Invite invite) async {
    if (state.busy) {
      return false;
    }
    emit(InvitesState(invites: state.invites, busy: true));
    try {
      await _repository.revoke(invite.id);
      if (!isClosed) {
        emit(
          InvitesState(
            invites: [
              for (final i in state.invites ?? const <Invite>[])
                if (i.id != invite.id) i,
            ],
          ),
        );
      }
      return true;
    } on HouseholdError catch (e) {
      if (!isClosed) {
        emit(InvitesState(invites: state.invites, problem: e.problem));
      }
      return false;
    }
  }
}
