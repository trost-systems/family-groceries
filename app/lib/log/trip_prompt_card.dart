import 'dart:async';

import 'package:family_groceries/analytics/flags.dart';
import 'package:family_groceries/app/notices.dart';
import 'package:family_groceries/design/motion.dart';
import 'package:family_groceries/design/sticker.dart';
import 'package:family_groceries/design/tokens.g.dart';
import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/list_cubit.dart';
import 'package:family_groceries/list/model.dart';
import 'package:family_groceries/log/model.dart';
import 'package:family_groceries/log/trip_prompts.dart';
import 'package:family_groceries/log/trip_sheet.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

/// The list's trip prompts, one card per store this device ticked off
/// (job 199). Nothing while the flag `grocery-log` is off or without
/// [TripPrompts] above.
class const TripPromptCards({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final on = context.select<Flags?, bool>(
      (flags) => flags?.isOn(groceryLogFlag) ?? false,
    );
    final prompts = context.watch<TripPrompts?>();
    final stores = context.select<ListCubit, List<Store>>(
      (list) => list.state.catalog.stores,
    );
    final shown = on && prompts != null ? prompts.prompts : <TripPrompt>[];
    final column = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final prompt in shown)
          _PromptCard(
            key: ValueKey('trip-prompt-${prompt.storeId ?? 'none'}'),
            prompt: prompt,
            store: stores.where((s) => s.id == prompt.storeId).firstOrNull,
          ),
      ],
    );
    final resize = hlMotion(context, HlDuration.medium);
    return resize == Duration.zero
        ? column
        : AnimatedSize(
            duration: resize,
            curve: HlEasing.standard,
            alignment: Alignment.topCenter,
            child: column,
          );
  }
}

class const _PromptCard({
  required final TripPrompt prompt,
  required final Store? store,
  super.key,
}) extends StatelessWidget {
  Future<void> _log(BuildContext context) async {
    final prompts = context.read<TripPrompts>();
    final notices = Notices.of(context);
    final logged = AppLocalizations.of(context).tripLogged;
    final change = await showTripSheet(
      context,
      source: TripSource.prompt,
      store: presetStore(prompt.storeId),
      id: prompts.idFor(prompt.storeId),
      items: [
        for (final item in prompt.items)
          TripItem(name: item.name, quantity: item.quantity),
      ],
    );
    if (change is TripSaved) {
      prompts.dismiss(prompt.storeId);
      notices.showSnackBar(SnackBar(content: Text(logged), persist: false));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = SnacklistColors.of(Theme.of(context).brightness);
    final names = [for (final item in prompt.items) item.name];
    final summary = names.length > 3
        ? l10n.tripSummaryMore(names.take(3).join(', '), names.length - 3)
        : names.join(', ');
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: HlSpace.s3,
        vertical: HlSpace.s2,
      ),
      child: Semantics(
        container: true,
        child: HlSticker(
          depth: StickerDepth.s,
          color: t.honeySoft,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              HlSpace.s3,
              HlSpace.s3,
              HlSpace.s3,
              HlSpace.s2,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: HlSpace.s1,
              children: [
                Text(switch (store) {
                  final store? => l10n.tripPromptAt(store.name),
                  null => l10n.tripPrompt,
                }, style: HlType.title.copyWith(color: t.text)),
                Text(
                  l10n.tripPromptTicked(names.length, summary),
                  style: HlType.body.copyWith(color: t.textMuted),
                ),
                OverflowBar(
                  alignment: MainAxisAlignment.end,
                  overflowAlignment: OverflowBarAlignment.end,
                  spacing: HlSpace.s2,
                  children: [
                    TextButton(
                      key: const ValueKey('trip-prompt-later'),
                      onPressed: () =>
                          context.read<TripPrompts>().dismiss(prompt.storeId),
                      child: Text(l10n.later),
                    ),
                    FilledButton(
                      key: const ValueKey('trip-prompt-log'),
                      onPressed: () => unawaited(_log(context)),
                      child: Text(l10n.tripPromptLog),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
