import Foundation

/// What the widget shows: the app's last payload (docs/HOME_WIDGETS.md, version 1), parsed.
enum ListSnapshot: Equatable {
  case ready(open: Int, items: [ListItem])
  case signedOut
  case noHousehold
  /// No payload yet, an unreadable one or another version: the widget asks to open the app.
  case noData

  static let appGroup = "group.com.hummlist.app"
  static let payloadKey = "hummlist_widget"

  static func read() -> ListSnapshot {
    parse(UserDefaults(suiteName: appGroup)?.string(forKey: payloadKey))
  }

  static func parse(_ json: String?) -> ListSnapshot {
    guard let data = json?.data(using: .utf8),
      let payload = try? JSONDecoder().decode(Payload.self, from: data),
      payload.version == 1
    else { return .noData }
    switch payload.state {
    case "ready":
      guard let open = payload.open, let items = payload.items else { return .noData }
      return .ready(open: open, items: items)
    case "signedOut": return .signedOut
    case "noHousehold": return .noHousehold
    default: return .noData
    }
  }

  private struct Payload: Decodable {
    let version: Int
    let state: String
    let open: Int?
    let items: [ListItem]?
  }
}

struct ListItem: Decodable, Equatable {
  let name: String
  let quantity: String?
  /// The store's full name, or nil without a store.
  let store: String?
}

/// One shown line: the item and, on the first row of each store run, the store's name for the pill.
struct ListRow: Identifiable {
  let id: Int
  let item: ListItem
  let storePill: String?

  static func rows(_ items: [ListItem], limit: Int) -> [ListRow] {
    items.prefix(limit).enumerated().map { index, item in
      let startsRun = index == 0 || items[index - 1].store != item.store
      return ListRow(id: index, item: item, storePill: startsRun ? item.store : nil)
    }
  }
}

enum WidgetLinks {
  /// The `homeWidget` query item tells the home_widget plugin the URL is its own.
  static let open = URL(string: "hummlist-widget://open/?homeWidget")!
  static let add = URL(string: "hummlist-widget://add/?homeWidget")!
}
