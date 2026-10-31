import 'package:flutter/widgets.dart';

import 'package:hummel_hex_poc/hummel_hex.dart';

void main() => runApp(const GalleryApp());

class const GalleryApp({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => WidgetsApp(
    title: 'Hummel Hex',
    color: HexColors.light.honey,
    debugShowCheckedModeBanner: false,
    builder: (context, _) => const Gallery(),
  );
}
