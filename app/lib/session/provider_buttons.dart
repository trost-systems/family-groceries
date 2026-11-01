import 'package:flutter/material.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

const _height = 48.0;
const _labelSize = 15.0;
const _radius = BorderRadius.all(Radius.circular(_height / 2));

/// Google's sign-in button: standard "G" from Google's asset kit, light or
/// dark theme colors, pill shape.
/// https://developers.google.com/identity/branding-guidelines
class const GoogleSignInButton({
  required final String label,
  required final VoidCallback? onPressed,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (fill, stroke, text) = dark
        ? (
            const Color(0xFF131314),
            const Color(0xFF8E918F),
            const Color(0xFFE3E3E3),
          )
        : (Colors.white, const Color(0xFF747775), const Color(0xFF1F1F1F));
    return SizedBox(
      height: _height,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: fill,
          foregroundColor: text,
          side: BorderSide(color: stroke),
          shape: const RoundedRectangleBorder(borderRadius: _radius),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          textStyle: const TextStyle(
            fontFamily: 'Google Sans',
            fontFamilyFallback: ['Roboto'],
            fontSize: _labelSize,
            height: 20 / _labelSize,
            fontWeight: FontWeight.w500,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset('assets/google_g.png', width: 20, height: 20),
            const SizedBox(width: 10),
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
  }
}

/// Apple's sign-in button drawn to the Human Interface Guidelines (black on
/// light, white on dark; system font; the logo from the sign_in_with_apple
/// package) at the same height and label size as Google's, which the
/// package's own button cannot do: it sizes the label at 0.43 of its height.
class const AppleSignInButton({
  required final String label,
  required final VoidCallback? onPressed,
  super.key,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (fill, text) = dark
        ? (Colors.white, Colors.black)
        : (Colors.black, Colors.white);
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      onTap: onPressed,
      excludeSemantics: true,
      child: SizedBox(
        height: _height,
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: fill,
            foregroundColor: text,
            disabledBackgroundColor: fill.withValues(alpha: 0.38),
            disabledForegroundColor: text,
            shape: const RoundedRectangleBorder(borderRadius: _radius),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            textStyle: const TextStyle(
              fontFamily: '.SF Pro Text',
              fontFamilyFallback: ['Inter'],
              fontSize: _labelSize,
              height: 20 / _labelSize,
              fontWeight: FontWeight.w500,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 14,
                height: 17,
                child: CustomPaint(painter: AppleLogoPainter(color: text)),
              ),
              const SizedBox(width: 10),
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            ],
          ),
        ),
      ),
    );
  }
}
