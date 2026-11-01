// Generated from design/tokens/hummlist.tokens.json by design/tokens/build.mjs. Do not edit.
import SwiftUI
import UIKit

/// Every colour token, switching with the widget's light or dark appearance.
enum HummlistColors {
  static let brand = dynamic(light: 0x1b3fae, dark: 0x9fb6ff)
  static let onBrand = dynamic(light: 0xffffff, dark: 0x0b1024)
  static let honey = dynamic(light: 0xffe24a, dark: 0xffe24a)
  static let onHoney = dynamic(light: 0x0f1530, dark: 0x0b1024)
  static let honeySoft = dynamic(light: 0xfff2a8, dark: 0x35310f)
  static let accent = dynamic(light: 0x1b3fae, dark: 0x9fb6ff)
  static let onAccent = dynamic(light: 0xffffff, dark: 0x0b1024)
  static let accentSoft = dynamic(light: 0xe1e8ff, dark: 0x1d2b66)
  static let surface = dynamic(light: 0xf7f7f2, dark: 0x0b1024)
  static let surfaceRaised = dynamic(light: 0xffffff, dark: 0x151c3a)
  static let surfaceSunken = dynamic(light: 0xeceff6, dark: 0x111735)
  static let text = dynamic(light: 0x0f1530, dark: 0xeff3ff)
  static let textMuted = dynamic(light: 0x4b536c, dark: 0xb0b9d8)
  static let border = dynamic(light: 0x0f1530, dark: 0x7f8cc4)
  static let divider = dynamic(light: 0xd3d8e6, dark: 0x2f3a66)
  static let ink = dynamic(light: 0x0f1530, dark: 0x03050f)
  static let success = dynamic(light: 0x0d7a4e, dark: 0x62c99d)
  static let onSuccess = dynamic(light: 0xffffff, dark: 0x0b1024)
  static let successSoft = dynamic(light: 0xd6f5e7, dark: 0x123a31)
  static let warning = dynamic(light: 0x8a5300, dark: 0xffd25a)
  static let onWarning = dynamic(light: 0xffffff, dark: 0x0b1024)
  static let error = dynamic(light: 0xc4280f, dark: 0xff8a73)
  static let onError = dynamic(light: 0xffffff, dark: 0x0b1024)
  static let edge = dynamic(light: 0x0f1530, dark: 0x03050f)
  static let honeyEdge = dynamic(light: 0xd4b20f, dark: 0xb39b1a)
  static let surfaceEdge = dynamic(light: 0xc3cae0, dark: 0x2a3463)
  static let mint = dynamic(light: 0x7fe3b8, dark: 0x62c99d)
  static let onMint = dynamic(light: 0x0f1530, dark: 0x0b1024)
  static let mintSoft = dynamic(light: 0xd6f5e7, dark: 0x123a31)
  static let mintEdge = dynamic(light: 0x3fbf8a, dark: 0x3a9e78)
  static let cobalt = dynamic(light: 0x1b3fae, dark: 0x2448c0)
  static let onCobalt = dynamic(light: 0xffffff, dark: 0xffffff)
  static let onAccentSoft = dynamic(light: 0x132f86, dark: 0xe1e8ff)
  static let tomato = dynamic(light: 0xff5b3a, dark: 0xf0603f)
  static let onTomato = dynamic(light: 0x0f1530, dark: 0x0b1024)
  static let tomatoEdge = dynamic(light: 0xc8402a, dark: 0xb04530)
  static let inverse = dynamic(light: 0x0f1530, dark: 0x111735)
  static let onInverse = dynamic(light: 0xf3f6ff, dark: 0xeff3ff)

  private static func dynamic(light: UInt32, dark: UInt32) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? rgb(dark) : rgb(light) })
  }

  private static func rgb(_ value: UInt32) -> UIColor {
    UIColor(
      red: CGFloat((value >> 16) & 0xff) / 255,
      green: CGFloat((value >> 8) & 0xff) / 255,
      blue: CGFloat(value & 0xff) / 255,
      alpha: 1)
  }
}
