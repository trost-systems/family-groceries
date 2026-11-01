import SwiftUI
import WidgetKit

struct HomeWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: ListSnapshot
}

/// Shows what the app last wrote to the App Group. The app reloads the timeline through WidgetCenter
/// whenever it writes, so the widget never refreshes on its own.
struct HomeWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(date: .now, snapshot: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    let snapshot = ListSnapshot.read()
    // The gallery shows a list rather than the prompt when the app has written nothing yet.
    let shown = context.isPreview && snapshot == .noData ? ListSnapshot.sample : snapshot
    completion(HomeWidgetEntry(date: .now, snapshot: shown))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let entry = HomeWidgetEntry(date: .now, snapshot: ListSnapshot.read())
    completion(Timeline(entries: [entry], policy: .never))
  }
}

struct HomeWidget: Widget {
  static let kind = "HomeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: HomeWidget.kind, provider: HomeWidgetProvider()) { entry in
      HomeWidgetView(snapshot: entry.snapshot)
    }
    .configurationDisplayName(String("Hummlist"))
    .description("Your shopping list at a glance")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

extension ListSnapshot {
  static let sample = ListSnapshot.ready(
    open: 9,
    items: [
      ListItem(name: "Hafermilch", quantity: "2 l", store: "Rewe"),
      ListItem(name: "Äpfel", quantity: "1 kg", store: "Rewe"),
      ListItem(name: "Zahnpasta", quantity: nil, store: "dm-drogerie markt"),
      ListItem(name: "Brot", quantity: nil, store: "Bäckerei Schneider am Marktplatz"),
      ListItem(name: "Basilikum", quantity: "1 Topf", store: nil),
      ListItem(name: "Kaffeebohnen", quantity: "500 g", store: nil),
    ])
}

#Preview("Small", as: .systemSmall) {
  HomeWidget()
} timeline: {
  HomeWidgetEntry(date: .now, snapshot: .sample)
  HomeWidgetEntry(date: .now, snapshot: .ready(open: 0, items: []))
  HomeWidgetEntry(date: .now, snapshot: .signedOut)
}

#Preview("Medium", as: .systemMedium) {
  HomeWidget()
} timeline: {
  HomeWidgetEntry(date: .now, snapshot: .sample)
  HomeWidgetEntry(date: .now, snapshot: .ready(open: 0, items: []))
  HomeWidgetEntry(date: .now, snapshot: .signedOut)
}
