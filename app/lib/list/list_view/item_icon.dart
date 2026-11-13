import 'dart:math' as math;

import 'package:family_groceries/l10n/app_localizations.dart';
import 'package:family_groceries/list/category_names.dart';
import 'package:family_groceries/list/list_view/item_icon_fallback.dart';
import 'package:family_groceries/list/list_view/item_icons.g.dart';
import 'package:family_groceries/list/model.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

/// The item icon table: folded forms as `tool/item_icons/build.mjs` writes
/// them to emoji, `''` for a stop, a leading `=` for whole words only.
/// [emojiFor] picks the first word, left to right, that has an icon: a
/// phrase of 3 or 2 words, the word itself, else its longest head of 3 or
/// more letters after 3 or more ("Vollmilch" takes "milch").
final class ItemIcons(final Map<String, String> _entries) {
  this {
    for (final MapEntry(:key, :value) in _entries.entries) {
      if (key.contains(' ')) {
        _phrases[key] = value;
        _phraseStarts.add(key.substring(0, key.indexOf(' ')));
      } else if (key.startsWith('=')) {
        _words[key.substring(1)] = value;
      } else {
        _words[key] = value;
        _heads[key] = value;
        _longestHead = math.max(_longestHead, key.length);
      }
    }
  }

  /// The table this build ships with.
  static final bundled = ItemIcons(itemIconEntries);

  /// The table under [context]'s [ItemIconsCubit], else [bundled].
  static ItemIcons of(BuildContext context) =>
      context.watch<ItemIconsCubit?>()?.state ?? bundled;

  static final _nonLetters = RegExp('[^a-z]+');

  final Map<String, String> _phrases = {};
  final Set<String> _phraseStarts = {};
  final Map<String, String> _words = {};
  final Map<String, String> _heads = {};
  var _longestHead = 0;

  /// Every emoji of the table, once each.
  Set<String> get emoji => {..._entries.values}..remove('');

  /// [entries] over these: one replaces a form with or without its `=`.
  ItemIcons over(Map<String, String> entries) {
    final merged = Map.of(_entries);
    for (final key in entries.keys) {
      merged
        ..remove(key)
        ..remove(key.startsWith('=') ? key.substring(1) : '=$key');
    }
    return ItemIcons(merged..addAll(entries));
  }

  /// The emoji for an item called [name], or null for the fallback glyph.
  String? emojiFor(String name) {
    final words = foldName(name).split(_nonLetters)
      ..removeWhere((w) => w.isEmpty);
    var i = 0;
    next:
    while (i < words.length) {
      final word = words[i];
      if (_phraseStarts.contains(word)) {
        for (final n in const [3, 2]) {
          if (i + n > words.length) {
            continue;
          }
          final value = _phrases[words.sublist(i, i + n).join(' ')];
          if (value == null) {
            continue;
          }
          if (value.isEmpty) {
            i += n;
            continue next;
          }
          return value;
        }
      }
      i++;
      final value = _words[word];
      if (value != null) {
        if (value.isEmpty) {
          continue;
        }
        return value;
      }
      for (
        var s = math.max(3, word.length - _longestHead);
        s <= word.length - 3;
        s++
      ) {
        final head = _heads[word.substring(s)];
        if (head != null) {
          if (head.isEmpty) {
            break;
          }
          return head;
        }
      }
    }
    return null;
  }
}

/// The table the rows show: [ItemIcons.bundled] until a newer remote table
/// is [use]d.
class ItemIconsCubit([ItemIcons? icons]) extends Cubit<ItemIcons> {
  this : super(icons ?? ItemIcons.bundled);

  void use(ItemIcons icons) => emit(icons);
}

/// Lays [icons]' emoji out once, off screen. On the web the engine picks a
/// fallback font for the characters a frame misses by how many of them it
/// covers, so a few emoji next to a symbol such as ⚪ went to the
/// monochrome Noto Sans Symbols 2, for the whole session (job 147). Missing
/// all of them at once, the colour emoji slices cover the most and win.
void warmItemIconFonts(ItemIcons icons) {
  TextPainter(
      text: TextSpan(
        text: icons.emoji.join(),
        style: const TextStyle(fontFamilyFallback: emojiFontFallback),
      ),
      textDirection: TextDirection.ltr,
    )
    ..layout()
    ..dispose();
}

/// A row's leading icon: the emoji [ItemIcons.of] finds for [name], else
/// the one neutral [ItemIconFallback], in the same box: [size] the emoji's
/// font size, [height] its line height in pixels.
class const ItemIcon(
  final String name, {
  required final double size,
  final double? height,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final height = this.height;
    final emoji = ItemIcons.of(context).emojiFor(name);
    // The fallback sits in a line of the emoji's style, so both get the same
    // box and the same vertical position next to the name.
    return Text.rich(
      emoji == null
          ? WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: ItemIconFallback(size: size),
            )
          : TextSpan(text: emoji),
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: size,
        height: height == null ? null : height / size,
        fontFamilyFallback: emojiFontFallback,
      ),
    );
  }
}

/// The emoji font by name, for the [ItemIcon] texts: the
/// same face the per-character fallback finds, but looked up once and
/// cached, where the fallback asks the system for every new paragraph
/// (fontconfig on Linux; about 15 % of the UI thread while flinging the
/// list, job 108). Where no font has this name the fallback works as
/// before.
const emojiFontFallback = ['Noto Color Emoji'];

/// A category's emoji: the one its name starts with, else the seeded
/// category's, else a basket.
String categoryIcon(Category? category) {
  if (category == null) {
    return '🧺';
  }
  final lead = _leadingSymbols.firstMatch(category.name)?.group(0)?.trim();
  if (lead != null && lead.isNotEmpty) {
    return lead;
  }
  return _categories[category.seedKey] ?? '🧺';
}

/// A category's name for its divider, without a leading emoji.
String categoryLabel(Category category, AppLocalizations l10n) {
  final name = categoryName(category, l10n);
  final label = name.replaceFirst(_leadingSymbols, '').trim();
  return label.isEmpty ? name : label;
}

final _leadingSymbols = RegExp(r'^[^\p{L}\p{N}]+', unicode: true);

const _categories = {
  'produce': '🥕',
  'bakery': '🥖',
  'chilled': '🥛',
  'meat': '🥩',
  'pantry': '🥫',
  'sweets': '🍫',
  'drinks': '🧃',
  'frozen': '🧊',
  'household': '🧽',
  'drugstore': '🧴',
  'paint': '🎨',
  'plumbing': '🚿',
  'electrical': '💡',
  'tools': '🔨',
  'fasteners': '🔩',
  'building': '🪵',
  'garden': '🌱',
  'other': '🛒',
};
