import 'package:family_groceries/list/model.dart';
import 'package:flutter/foundation.dart';

/// Why the add sheet offers a row; each row is labelled with it.
enum SuggestionSource() {
  /// What was typed, as the server's parser reads it.
  typed,

  /// Bought before, with that time's brand and details.
  history,

  /// Another pack of what was typed (Big Pack, 4er Pack).
  pack,

  /// What was typed plus a detail bought before (laktosefrei).
  variant,

  /// One size up or down (Größe 4, Größe 2).
  size,

  /// Another brand of the same product.
  brand,

  /// A word from the dictionary that starts like the last word typed.
  catalog,

  /// Bought regularly and due again: shown before anything is typed.
  due;

  static SuggestionSource byName(String name) =>
      values.where((s) => s.name == name).firstOrNull ?? typed;
}

/// One tappable row of the add sheet: an entry with all its fields.
@immutable
class const Suggestion(final SuggestionSource source, final ParsedEntry entry) {
  /// A row of `public.suggest_entries`.
  factory fromJson(Map<String, Object?> json) => Suggestion(
    SuggestionSource.byName(json['source']! as String),
    ParsedEntry.fromJson(json),
  );

  /// The same item whatever the quantity: rows with one key are one row.
  String get key => [
    foldName(entry.name),
    foldName(entry.brand ?? ''),
    foldName(entry.properties ?? ''),
  ].join('|');
}
