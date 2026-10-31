import 'package:flutter/widgets.dart';
import 'package:hummel_hex_widgetbook/catalog.dart';
import 'package:widgetbook/widgetbook.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadHexFonts();
  runWidgetbook(catalogConfig());
}
