import SwiftUI

/// The app's Hex Soft outline (app/lib/design/hex_border.dart): a hexagon with filleted corners,
/// 120° at every flat-side corner. The constants are the `HlHex` tokens.
struct Hex: InsettableShape {
  enum Orientation {
    /// Flat top and bottom, pointed ends: pills and buttons.
    case horizontal
    /// Pointed top and bottom: badges.
    case pointyTop
  }

  static let tip: CGFloat = 0.2887
  private static let cornerRadius: CGFloat = 8
  private static let referenceHeight: CGFloat = 48

  var orientation: Orientation = .horizontal
  /// Positive grows the outline outward, as a parallel curve; `strokeBorder` insets with it.
  var outset: CGFloat = 0

  func inset(by amount: CGFloat) -> Hex {
    var hex = self
    hex.outset -= amount
    return hex
  }

  func path(in rect: CGRect) -> Path {
    let horizontal = orientation == .horizontal
    let across = horizontal ? rect.height : rect.width
    // Every vertex keeps its angle under an offset: the flat sides move by the outset, the tips
    // by outset / sin(phi), and every fillet radius grows by the outset.
    let along = outset / sin(atan(1 / (2 * Hex.tip)))
    let r =
      horizontal
      ? rect.insetBy(dx: -along, dy: -outset)
      : rect.insetBy(dx: -outset, dy: -along)
    let radius = max(0, Hex.cornerRadius * across / Hex.referenceHeight + outset)
    return Hex.rounded(vertices(r), radius: radius)
  }

  private func vertices(_ r: CGRect) -> [CGPoint] {
    switch orientation {
    case .horizontal:
      let t = min(Hex.tip * r.height, r.width / 2)
      return [
        CGPoint(x: r.minX, y: r.midY), CGPoint(x: r.minX + t, y: r.minY),
        CGPoint(x: r.maxX - t, y: r.minY), CGPoint(x: r.maxX, y: r.midY),
        CGPoint(x: r.maxX - t, y: r.maxY), CGPoint(x: r.minX + t, y: r.maxY),
      ]
    case .pointyTop:
      let t = min(Hex.tip * r.width, r.height / 2)
      return [
        CGPoint(x: r.midX, y: r.minY), CGPoint(x: r.maxX, y: r.minY + t),
        CGPoint(x: r.maxX, y: r.maxY - t), CGPoint(x: r.midX, y: r.maxY),
        CGPoint(x: r.minX, y: r.maxY - t), CGPoint(x: r.minX, y: r.minY + t),
      ]
    }
  }

  /// Each corner is an arc tangent to both sides, its tangent points clamped to half the shorter
  /// side so neighbouring fillets never overlap.
  private static func rounded(_ v: [CGPoint], radius: CGFloat) -> Path {
    var path = Path()
    guard radius > 0 else {
      path.addLines(v)
      path.closeSubpath()
      return path
    }
    let n = v.count
    for i in 0..<n {
      let prev = v[(i + n - 1) % n]
      let cur = v[i]
      let next = v[(i + 1) % n]
      let toPrev = CGVector(dx: prev.x - cur.x, dy: prev.y - cur.y)
      let toNext = CGVector(dx: next.x - cur.x, dy: next.y - cur.y)
      let lenPrev = hypot(toPrev.dx, toPrev.dy)
      let lenNext = hypot(toNext.dx, toNext.dy)
      let cosine = (toPrev.dx * toNext.dx + toPrev.dy * toNext.dy) / (lenPrev * lenNext)
      let halfTan = tan(acos(min(1, max(-1, cosine))) / 2)
      let t = min(radius / halfTan, min(lenPrev, lenNext) / 2)
      if i == 0 {
        path.move(to: CGPoint(x: cur.x + toPrev.dx / lenPrev * t, y: cur.y + toPrev.dy / lenPrev * t))
      }
      path.addArc(tangent1End: cur, tangent2End: next, radius: t * halfTan)
    }
    path.closeSubpath()
    return path
  }
}

/// A hex-tipped pill: a fill, the navy contour, and the content clear of the tips.
struct HexPill<Content: View>: View {
  let fill: Color
  let height: CGFloat
  var contour: CGFloat = 2
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(.horizontal, Hex.tip * height + 4)
      .frame(height: height)
      .background(Hex().fill(fill))
      .overlay(Hex().strokeBorder(HummlistColors.border, lineWidth: contour))
  }
}
