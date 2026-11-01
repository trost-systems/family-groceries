import SwiftUI
import WidgetKit

struct HomeWidgetView: View {
  let snapshot: ListSnapshot
  @Environment(\.widgetFamily) private var family

  private var medium: Bool { family == .systemMedium }

  var body: some View {
    content
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .widgetURL(WidgetLinks.open)
      .containerBackground(for: .widget) { HummlistColors.surface }
  }

  @ViewBuilder private var content: some View {
    switch snapshot {
    case .ready(let open, _) where open == 0:
      AllDone(medium: medium)
    case .ready(let open, let items):
      OpenList(open: open, items: items, medium: medium)
    case .signedOut:
      Prompt(message: "Sign in to Hummlist")
    case .noHousehold:
      Prompt(message: "Set up your household in Hummlist")
    case .noData:
      Prompt(message: "Open Hummlist to see your list")
    }
  }
}

/// The focal number: the open count, large and heavy in brand, then the localized word muted.
private func openCount(_ open: Int, size: CGFloat) -> Text {
  var text = AttributedString(localized: "\(open) open")
  text.font = Font.system(size: size * 0.5, weight: .semibold)
  text.foregroundColor = HummlistColors.textMuted
  if let number = text.range(of: String(open)) {
    text[number].font = Font.system(size: size, weight: .heavy)
    text[number].foregroundColor = HummlistColors.brand
  }
  return Text(text)
}

private struct OpenList: View {
  let open: Int
  let items: [ListItem]
  let medium: Bool

  var body: some View {
    // The most rows that fit this device's widget height, footer included.
    let most = medium ? 5 : 3
    ViewThatFits(in: .vertical) {
      page(rows: most)
      page(rows: most - 1)
      page(rows: most - 2)
    }
  }

  private func page(rows limit: Int) -> some View {
    let rows = ListRow.rows(items, limit: limit)
    let more = open - rows.count
    return VStack(alignment: .leading, spacing: 0) {
      if medium {
        HStack(alignment: .center) {
          openCount(open, size: 26).lineLimit(1)
          Spacer(minLength: 8)
          Link(destination: WidgetLinks.add) { AddButton() }
        }
      } else {
        openCount(open, size: 34).lineLimit(1).minimumScaleFactor(0.6)
      }
      VStack(alignment: .leading, spacing: 3) {
        ForEach(rows) { row in
          Row(row: row, medium: medium)
        }
      }
      .padding(.top, medium ? 6 : 4)
      if more > 0 {
        Text("+\(more) more")
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(HummlistColors.textMuted)
          .lineLimit(1)
          .padding(.top, 4)
      }
    }
  }
}

private struct Row: View {
  let row: ListRow
  let medium: Bool

  var body: some View {
    HStack(spacing: 6) {
      label
        .font(.system(size: medium ? 14 : 13, weight: .semibold))
        .lineLimit(1)
        // The pill comes first, but the name keeps room to read.
        .frame(minWidth: 96, alignment: .leading)
      Spacer(minLength: 0)
      if medium, let store = row.storePill {
        StorePill(name: store).layoutPriority(1)
      }
    }
    .frame(height: 18)
  }

  private var label: Text {
    let name = Text(row.item.name).foregroundStyle(HummlistColors.text)
    guard let quantity = row.item.quantity, !quantity.isEmpty else { return name }
    return name
      + Text(verbatim: " \(quantity)")
      .fontWeight(.regular)
      .foregroundStyle(HummlistColors.textMuted)
  }
}

/// Like the app's StoreBadge: the store's full name on a raised face with the navy contour.
private struct StorePill: View {
  let name: String

  var body: some View {
    HexPill(fill: HummlistColors.surfaceRaised, height: 18, contour: 1.5) {
      Text(verbatim: name)
        .font(.system(size: 11, weight: .heavy))
        .foregroundStyle(HummlistColors.text)
        .lineLimit(1)
        .truncationMode(.tail)
    }
  }
}

private struct AddButton: View {
  var body: some View {
    HexPill(fill: HummlistColors.honey, height: 30) {
      HStack(spacing: 4) {
        Image(systemName: "plus").font(.system(size: 12, weight: .bold))
        Text("Add").font(.system(size: 13, weight: .bold)).lineLimit(1)
      }
      .foregroundStyle(HummlistColors.onHoney)
    }
  }
}

private struct AllDone: View {
  let medium: Bool

  var body: some View {
    if medium {
      HStack(spacing: 12) {
        mark
        label
        Spacer(minLength: 8)
        Link(destination: WidgetLinks.add) { AddButton() }
      }
      .frame(maxHeight: .infinity)
    } else {
      VStack(spacing: 10) {
        mark
        label
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  /// A honey badge, pointed top and bottom like the app's hex tick.
  private var mark: some View {
    ZStack {
      Hex(orientation: .pointyTop).fill(HummlistColors.honey)
      Hex(orientation: .pointyTop).strokeBorder(HummlistColors.border, lineWidth: 2)
      Image(systemName: "checkmark")
        .font(.system(size: 18, weight: .heavy))
        .foregroundStyle(HummlistColors.onHoney)
    }
    .frame(width: 40, height: 46)
  }

  private var label: some View {
    Text("All done")
      .font(.system(size: 16, weight: .bold))
      .foregroundStyle(HummlistColors.text)
      .lineLimit(1)
  }
}

private struct Prompt: View {
  let message: LocalizedStringKey

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(verbatim: "Hummlist")
        .font(.system(size: 17, weight: .heavy))
        .foregroundStyle(HummlistColors.brand)
      Text(message)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(HummlistColors.text)
        .lineLimit(4)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}
