import 'package:flutter/widgets.dart';
import 'package:hummlist_widgetbook/catalog.dart';
import 'package:widgetbook/widgetbook.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadAppFonts();
  runWidgetbook(catalogConfig());
}
