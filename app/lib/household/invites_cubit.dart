import 'dart:async';

import 'package:family_groceries/household/invite_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Where the household's group link stands, as the invite sheet shows it.
sealed class const GroupLink();

/// No open group link: one can be made.
final class const GroupLinkNone() extends GroupLink;

/// Open, with room for more.
final class const GroupLinkActive(final Invite invite) extends GroupLink;

/// Open, but [Invite.maxUses] joined: a new one is needed.
final class const GroupLinkFull(final Invite invite) extends GroupLink;

/// Revoked in this sheet just now; who joined with it still shows.
final class const GroupLinkRevoked(final Invite invite) extends GroupLink;

@immutable
class const InvitesState({
  /// The open invites, person and group, newest first; null until loaded.
  final List<Invite>? invites,

  /// The group link revoked here, until another one is made.
  final Invite? revokedGroup,

  /// Who joined with the group link shown; null until loaded.
  final List<InviteJoin>? joins,

  /// Creating or revoking one: the buttons wait.
  final bool busy = false,
  final HouseholdProblem? problem,
}) {
  /// The open person invites, newest first.
  List<Invite> get people => [
    for (final i in invites ?? const <Invite>[])
      if (i.kind == InviteKind.person) i,
  ];

  GroupLink get group => switch ((invites ?? const <Invite>[])
      .where((i) => i.kind == InviteKind.group)
      .firstOrNull) {
    final open? when open.full => GroupLinkFull(open),
    final open? => GroupLinkActive(open),
    null => switch (revokedGroup) {
      final revoked? => GroupLinkRevoked(revoked),
      null => const GroupLinkNone(),
    },
  };

  InvitesState copyWith({
    List<Invite>? invites,
    List<InviteJoin>? joins,
    bool busy = false,
    HouseholdProblem? problem,
  }) => InvitesState(
    invites: invites ?? this.invites,
    revokedGroup: revokedGroup,
    joins: joins ?? this.joins,
    busy: busy,
    problem: problem,
  );
}

/// The invites of one household: onboarding's Step 3 makes the first, the
/// invite sheet and More's Einladungen list them, make person invites and
/// the group link, revoke, and show who joined with the group link. Used,
/// revoked and expired person invites are not listed.
class InvitesCubit(
  final InviteRepository _repository,
  final String _householdId, {

  /// Step 3 starts empty and makes one on the user's tap; the sheet lists.
  final bool load = true,
}) extends Cubit<InvitesState> {
  this : super(InvitesState(invites: load ? null : const [])) {
    if (load) {
      unawaited(reload());
    }
  }

  /// How often [startPolling] reloads, so uses and who joined follow.
  /// Polled: `invite_uses` is not in the realtime publication, whose
  /// DELETE events would reach subscribers of other households.
  static const livePeriod = Duration(seconds: 5);

  /// A poll's load that hasn't answered by then is given up, so the next
  /// tick asks again instead of waiting for it forever.
  static const loadTimeout = Duration(seconds: 20);

  Timer? _poll;
  var _polled = false;

  /// Bumped by each load and each change made here: only the newest load
  /// emits, so a late answer can't bring back a revoked link.
  var _generation = 0;
  var _loading = 0;

  /// Reloads every [livePeriod] until [stopPolling]; when it polled before
  /// (the panel is back on screen), reloads at once too.
  void startPolling() {
    if (_poll != null || isClosed) {
      return;
    }
    if (_polled) {
      unawaited(_tick());
    }
    _polled = true;
    _poll = Timer.periodic(livePeriod, (_) => unawaited(_tick()));
  }

  /// No more reloads until [startPolling]: the panel is off screen or the
  /// app is in the background.
  void stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  Future<void> _tick() async {
    if (state.busy || _loading > 0) {
      return;
    }
    await reload();
  }

  /// The open invites, then who joined with the group link.
  Future<void> reload() async {
    final load = ++_generation;
    _loading++;
    try {
      final invites = await _repository.open(_householdId).timeout(loadTimeout);
      if (isClosed || load != _generation) {
        return;
      }
      emit(state.copyWith(invites: invites, busy: state.busy));
      await _loadJoins(load);
    } on HouseholdError catch (e) {
      if (!isClosed && load == _generation) {
        emit(state.copyWith(problem: e.problem, busy: state.busy));
      }
    } on TimeoutException {
      // The next tick asks again.
    } finally {
      _loading--;
    }
  }

  /// Who joined with the group link shown; a failure keeps the last list.
  Future<void> _loadJoins(int load) async {
    final link = switch (state.group) {
      GroupLinkActive(:final invite) ||
      GroupLinkFull(:final invite) ||
      GroupLinkRevoked(:final invite) => invite,
      GroupLinkNone() => null,
    };
    try {
      final joins = link == null
          ? const <InviteJoin>[]
          : await _repository.joins(link.id).timeout(loadTimeout);
      if (!isClosed && load == _generation) {
        emit(state.copyWith(joins: joins, busy: state.busy));
      }
    } on HouseholdError catch (e) {
      if (!isClosed && load == _generation) {
        emit(state.copyWith(problem: e.problem, busy: state.busy));
      }
    } on TimeoutException {
      // The last list stays; the next tick asks again.
    }
  }

  /// Makes a new invite of [kind] and lists it; null when it failed (the
  /// state says why) or another call is running (a double tap). A group
  /// link replaces the one shown, and who joined starts empty.
  Future<Invite?> create({InviteKind kind = InviteKind.person}) async {
    if (state.busy) {
      return null;
    }
    emit(state.copyWith(busy: true));
    try {
      final invite = await _repository.create(_householdId, kind: kind);
      final load = ++_generation;
      if (!isClosed) {
        final others = [
          for (final i in state.invites ?? const <Invite>[])
            if (i.id != invite.id &&
                (kind == InviteKind.person || i.kind != InviteKind.group))
              i,
        ];
        emit(
          InvitesState(
            invites: [invite, ...others],
            joins: kind == InviteKind.group ? null : state.joins,
          ),
        );
        if (kind == InviteKind.group) {
          await _loadJoins(load);
        }
      }
      return invite;
    } on HouseholdError catch (e) {
      if (!isClosed) {
        emit(state.copyWith(problem: e.problem));
      }
      return null;
    }
  }

  /// Revokes [invite]: its link and code stop working at once.
  Future<void> revoke(Invite invite) async {
    if (state.busy) {
      return;
    }
    emit(state.copyWith(busy: true));
    try {
      await _repository.revoke(invite.id);
      _generation++;
      if (!isClosed) {
        emit(
          InvitesState(
            invites: [
              for (final i in state.invites ?? const <Invite>[])
                if (i.id != invite.id) i,
            ],
            revokedGroup: invite.kind == InviteKind.group
                ? invite
                : state.revokedGroup,
            joins: state.joins,
          ),
        );
      }
    } on HouseholdError catch (e) {
      if (!isClosed) {
        emit(state.copyWith(problem: e.problem));
      }
    }
  }

  /// A new group link in place of the open one, which stops working.
  Future<Invite?> renewGroup() async {
    if (state.group
        case GroupLinkActive(:final invite) || GroupLinkFull(:final invite)) {
      await revoke(invite);
      if (state.problem != null) {
        return null;
      }
    }
    return await create(kind: InviteKind.group);
  }

  @override
  Future<void> close() async {
    _poll?.cancel();
    await super.close();
  }
}
