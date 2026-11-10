import 'package:flutter/widgets.dart';
import 'package:snacklist_widgetbook/catalog.dart';
import 'package:widgetbook/widgetbook.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadAppFonts();
  runWidgetbook(catalogConfig());
}
