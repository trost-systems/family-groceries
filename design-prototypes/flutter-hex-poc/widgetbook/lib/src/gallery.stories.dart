import 'package:flutter/widgets.dart';
import 'package:hummel_hex_poc/hummel_hex.dart';
import 'package:widgetbook/widgetbook.dart';

part 'gallery.stories.g.dart';

const meta = Meta(Gallery.new);

const componentMeta = ComponentMeta(path: 'Hummel Hex');

/// The PoC's own overview: every widget in both variants, light and dark. It
/// brings its four themes along, so the Theme addon does not change it.
final $AllVariants = _Story(
  name: 'All variants',
  // The gallery scrolls, so it needs a bounded height, also in snapshots,
  // whose canvas is unbounded. Within these bounds it fills the preview and
  // wraps its four panels to the width it gets.
  setup: (context, child, args) => ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 1640, maxHeight: 1040),
    child: child,
  ),
);
