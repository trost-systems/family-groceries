import 'dart:async';
import 'dart:math' as math;

import 'package:family_groceries/analytics/analytics.dart';
import 'package:family_groceries/app/notices.dart';
import 'package:family_groceries/design/field_border.dart';
import 'package:family_groceries/design/hex_checkbox.dart';
import 'package:family_groceries/design/motion.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/feedback/feedback_context.dart';
import 'package:family_groceries/feedback/feedback_cubit.dart';
import 'package:family_groceries/feedback/feedback_repository.dart';
import 'package:family_groceries/feedback/screen_tracker.dart';
import 'package:family_groceries/feedback/shake.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/purchases/entitlements.dart';
import 'package:family_groceries/session/session_cubit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

/// From this many characters on, the form shows how many are used.
const _counterFrom = 1800;

/// Opens the feedback form over the whole app, from More's row or a shake
/// ([entry]); while it shows, this does nothing. The note waiting in
/// [FeedbackCubit] comes back; after a send the form closes and says
/// thanks.
Future<void> showFeedbackSheet(
  BuildContext context, {
  required FeedbackEntryPoint entry,
}) async {
  final cubit = context.read<FeedbackCubit>();
  final session = context.read<SessionCubit>().state;
  cubit.open(
    userId: switch (session) {
      InHousehold(:final userId) || NeedsHousehold(:final userId) => userId,
      _ => null,
    },
  );
  final scene = _sceneOf(context, entry);
  final messenger = Notices.of(context);
  final l10n = AppLocalizations.of(context);
  final sent = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: true,
    constraints: const BoxConstraints(maxWidth: 640),
    sheetAnimationStyle: AnimationStyle(
      curve: HlEasing.standard,
      reverseCurve: HlEasing.exit,
      duration: hlMotion(context, HlDuration.medium),
      reverseDuration: hlMotion(context, HlDuration.short),
    ),
    builder: (_) => BlocProvider.value(
      value: cubit,
      child: FeedbackForm(scene: scene),
    ),
  );
  if (sent ?? false) {
    messenger.showSnackBar(
      SnackBar(
        key: const ValueKey('feedback-thanks'),
        content: Text(l10n.feedbackThanks),
      ),
    );
  }
}

/// Taken when the form opens: the note is about the screen the user was
/// on then, as it looked then.
FeedbackScene _sceneOf(BuildContext context, FeedbackEntryPoint entry) {
  final screens = context.read<ScreenTracker>();
  final entitlements = context.read<Entitlements>();
  return FeedbackScene(
    entryPoint: entry,
    screen: switch (entry) {
      FeedbackEntryPoint.more => screens.feedbackScreen,
      FeedbackEntryPoint.shake => screens.current,
    },
    theme: Theme.of(context).brightness,
    orientation: MediaQuery.orientationOf(context),
    // At body size: Android's non-linear scaling grows small text more.
    textScale: textScaleBucket(MediaQuery.textScalerOf(context).scale(14) / 14),
    online: FeedbackOnline.of(context.read<ListCubit?>()?.state.connection),
    entitlement: FeedbackEntitlement.of(entitlements.state, entitlements.clock),
  );
}

/// The form: the note, the optional kind and contact, what is attached,
/// Send (Retry after a failure). Pops `true` once the note arrived.
class const FeedbackForm({required final FeedbackScene scene, super.key})
    extends StatefulWidget {
  @override
  State<FeedbackForm> createState() => _FeedbackFormState();
}

class _FeedbackFormState() extends State<FeedbackForm> {
  late final _message = TextEditingController(
    text: context.read<FeedbackCubit>().state.message,
  );

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final cubit = context.read<FeedbackCubit>();
    final device = context.read<FeedbackDevice>();
    final analytics = context.read<Analytics>();
    final locale = Localizations.localeOf(context).languageCode;
    final householdId = switch (context.read<SessionCubit>().state) {
      InHousehold(:final household) => household.id,
      _ => null,
    };
    // The status changes at once, so a second tap meets a disabled button.
    if (!cubit.state.canSend) {
      return;
    }
    final facts = await device.read();
    final ok = await cubit.send(
      FeedbackContext(
        appVersion: facts.appVersion,
        build: facts.build,
        platform: facts.platform,
        osVersion: facts.osVersion,
        deviceModel: facts.deviceModel,
        locale: locale,
        isInternal: analytics.internalNow,
        householdId: householdId,
        scene: widget.scene,
      ),
    );
    if (ok && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final media = MediaQuery.of(context);
    final keyboard = media.viewInsets.bottom;
    final state = context.watch<FeedbackCubit>().state;
    final sending = state.status == FeedbackStatus.sending;
    final failed = state.status == FeedbackStatus.failed;
    final tooLong = state.tooLong
        ? l10n.feedbackTooLong(maxFeedbackLength)
        : null;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: Semantics(
        container: true,
        explicitChildNodes: true,
        label: l10n.feedbackRow,
        child: SingleChildScrollView(
          child: Column(
            key: const ValueKey('feedback-sheet'),
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 16,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Container(
                    margin: const EdgeInsets.only(top: 7),
                    width: 32,
                    height: 4,
                    decoration: BoxDecoration(
                      color: scheme.outlineVariant,
                      borderRadius: BorderRadius.circular(HlRadius.full),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(
                          l10n.feedbackRow,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      key: const ValueKey('feedback-close'),
                      tooltip: l10n.feedbackClose,
                      onPressed: () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: RoundedFields(
                  child: Semantics(
                    hint: tooLong ?? '',
                    child: TextField(
                      autofillHints: null,
                      key: const ValueKey('feedback-message'),
                      controller: _message,
                      autofocus: true,
                      readOnly: sending,
                      minLines: 4,
                      maxLines: 8,
                      keyboardType: TextInputType.multiline,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: context.read<FeedbackCubit>().edit,
                      decoration: InputDecoration(
                        labelText: l10n.feedbackMessage,
                        hintText: l10n.feedbackMessageHint,
                        alignLabelWithHint: true,
                        error: tooLong == null ? null : FieldError(tooLong),
                      ),
                    ),
                  ),
                ),
              ),
              if (state.length >= _counterFrom)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                  child: Text(
                    l10n.feedbackCounter(state.length, maxFeedbackLength),
                    key: const ValueKey('feedback-counter'),
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontSize: 13,
                      color: state.tooLong
                          ? scheme.error
                          : scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                child: Text(
                  l10n.feedbackCategories,
                  style: TextStyle(
                    fontSize: 13,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (category, label) in [
                      (FeedbackCategory.bug, l10n.feedbackCategoryBug),
                      (FeedbackCategory.idea, l10n.feedbackCategoryIdea),
                      (FeedbackCategory.other, l10n.feedbackCategoryOther),
                    ])
                      ChoiceChip(
                        key: ValueKey('feedback-category-${category.name}'),
                        label: Text(label),
                        selected: state.category == category,
                        onSelected: sending
                            ? null
                            : (_) =>
                                  context.read<FeedbackCubit>().pick(category),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 12, 0),
                child: HexCheckboxListTile(
                  key: const ValueKey('feedback-contact'),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                  title: Text(l10n.feedbackContact),
                  value: state.contactOk,
                  onChanged: sending
                      ? null
                      : (on) =>
                            context.read<FeedbackCubit>().setContact(ok: on),
                ),
              ),
              if (shakeSupported(web: kIsWeb, platform: defaultTargetPlatform))
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                  child: Text(
                    l10n.feedbackShakeHint,
                    key: const ValueKey('feedback-shake-hint'),
                    style: TextStyle(
                      fontSize: 13,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Text(
                  '${l10n.feedbackAttachedTitle} ${l10n.feedbackAttached}',
                  key: const ValueKey('feedback-attached'),
                  style: TextStyle(
                    fontSize: 13,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
              if (failed)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(
                      l10n.feedbackFailed,
                      key: const ValueKey('feedback-error'),
                      style: TextStyle(color: scheme.error),
                    ),
                  ),
                ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  14,
                  20,
                  16 + math.max(0, media.padding.bottom - keyboard),
                ),
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: FilledButton(
                    key: ValueKey(failed ? 'feedback-retry' : 'feedback-send'),
                    style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.standard,
                      minimumSize: const Size(132, 52),
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      textStyle: const TextStyle(
                        fontFamily: HlFont.sans,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    onPressed: state.canSend ? () => unawaited(_send()) : null,
                    child: sending
                        ? Semantics(
                            label: l10n.feedbackSending,
                            child: const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                              ),
                            ),
                          )
                        : Text(failed ? l10n.feedbackRetry : l10n.feedbackSend),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
