import AppIntents
import Foundation
import UIKit

/// Adds what the user says to the household's list through `voice`: the list `list` names, else
/// the user's default list. Runs in the background:
/// the answer is Siri's dialog, the app never comes forward.
struct AddItemsIntent: AppIntent {
  static let title: LocalizedStringResource = "Add to Snacklist"
  static let description = IntentDescription("Adds items to your household's Snacklist.")

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .background }

  @Parameter(title: "Items")
  var text: String?

  @Parameter(title: "Item")
  var item: ItemSuggestion?

  /// The list to add to, by name ("Geburtstag"), matched on the server like Alexa's (job 207):
  /// without it, the user's default list, or a list the dictated text names ("Luftballons zur
  /// Geburtstag Liste"). An unknown name adds to the default list and the answer says so.
  @Parameter(title: "List")
  var list: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let client = VoiceClient.live(caller: item == nil ? "AddItems" : "AddItems.item")
    VoiceClient.log.notice("\(client.caller, privacy: .public): invoked, text \(text == nil ? "none" : "given", privacy: .public)")
    guard client.credential() != nil else {
      let lang = VoiceLanguage.of(text)
      return .result(dialog: dialog(VoiceResult.failed(.notSignedIn).answer(mode: .add, copy: SiriCopy(lang))))
    }
    let spoken: String
    let lang: VoiceLanguage
    if let item {
      spoken = item.id
      lang = VoiceLanguage.of(nil)
    } else {
      var dictated = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      if dictated.isEmpty {
        let ask = SiriCopy(VoiceLanguage.of(nil))[.askItems]
        let asked: String? = try await $text.requestValue(dialog(ask))
        dictated = asked ?? ""
      }
      spoken = dictated
      lang = VoiceLanguage.of(dictated)
    }
    let result = await client.send(text: spoken, mode: .add, lang: lang, ask: true, list: list)
    guard case .confirm(let speech, let question, let again, let used) = result else {
      return .result(dialog: dialog(result.answer(mode: .add, copy: SiriCopy(lang))))
    }
    // Q79: one yes/no question; a no, a cancel or no answer adds nothing more.
    let yes = (try? await $text.requestConfirmation(for: spoken, dialog: dialog(question))) ?? false
    guard yes else { return .result(dialog: dialog(speech)) }
    let added = await client.send(text: again, mode: .add, lang: lang, confirmed: true, list: used ?? list)
    return .result(dialog: dialog(added.answer(mode: .add, copy: SiriCopy(lang))))
  }
}

/// Reads the open items of the household's list (the server caps what it says).
struct ReadListIntent: AppIntent {
  static let title: LocalizedStringResource = "Read my Snacklist"
  static let description = IntentDescription("Reads the open items on your household's Snacklist.")

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .background }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let lang = VoiceLanguage.of(nil)
    let result = await VoiceClient.live(caller: "ReadList").send(text: nil, mode: .read, lang: lang)
    return .result(dialog: dialog(result.answer(mode: .read, copy: SiriCopy(lang))))
  }
}

/// Opens the app on the list, for "Show my Snacklist". The one intent that needs the app in front.
struct OpenListIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Snacklist"
  static let description = IntentDescription("Opens your household's Snacklist.")

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .foreground }

  /// The link a widget tap opens (ListSnapshot.swift, lib/home_widget): the app goes to the list
  /// from wherever it was.
  static let list = URL(string: "snacklist-widget://open/?homeWidget")!

  @MainActor
  func perform() async throws -> some IntentResult {
    _ = await UIApplication.shared.open(Self.list)
    return .result()
  }
}

/// Before iOS 26 `openAppWhenRun` is how an intent brings the app forward.
@available(*, deprecated)
extension OpenListIntent {
  static var openAppWhenRun: Bool { true }
}

/// One of the household's known items, the value of "Add <item> to Snacklist". The app hands the
/// names over (`snacklist/siri` `suggestions`); its id is the name itself. Its synonyms are the
/// household's other names for the same item (the same `canonical_key`), so "Füge Möhren zu
/// Snacklist hinzu" matches the "Karotten" the household usually buys.
struct ItemSuggestion: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Item")
  static let defaultQuery = ItemSuggestionQuery()

  let id: String
  var synonyms: [String] = []

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(id)", subtitle: nil, image: nil,
      synonyms: synonyms.map { "\($0)" as LocalizedStringResource })
  }
}

struct ItemSuggestionQuery: EntityStringQuery {
  var store = ItemSuggestionStore()

  func entities(for identifiers: [String]) async throws -> [ItemSuggestion] {
    let known = Dictionary(store.entries().map { ($0.name, $0) }, uniquingKeysWith: { first, _ in first })
    return identifiers.map { ItemSuggestion(id: $0, synonyms: known[$0]?.synonyms ?? []) }
  }

  func entities(matching string: String) async throws -> [ItemSuggestion] {
    store.entries()
      .filter { entry in
        ([entry.name] + entry.synonyms).contains { $0.localizedCaseInsensitiveContains(string) }
      }
      .map { ItemSuggestion($0) }
  }

  func suggestedEntities() async throws -> [ItemSuggestion] {
    store.entries().map { ItemSuggestion($0) }
  }
}

extension ItemSuggestion {
  init(_ entry: ItemSuggestionStore.Entry) {
    self.init(id: entry.name, synonyms: entry.synonyms)
  }
}

/// The phrases. Each Swift phrase is the key of a set of phrases per language in
/// AppShortcuts.xcstrings (iOS 17 deployment target, job 97), so German says the same thing in as
/// many ways as it needs. Each one names the app and has at most one parameter (an entity);
/// RunnerTests and scripts/siri-phrases.ts check the catalog against this file.
///
/// The phrase without an item comes first: Siri then asks for the items, which works for any
/// item, while an `item` phrase matches only the names the app suggested. German phrases name the
/// app first or as the object ("Snacklist, füge etwas hinzu"), never "Einkaufsliste" or a bare
/// "auf meine Snacklist": those are Reminders' grammar, and Reminders wins (job 92).
struct SnacklistShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddItemsIntent(),
      phrases: [
        "Add to \(.applicationName)",
        "Add \(\.$item) to \(.applicationName)",
      ],
      shortTitle: "Add to Snacklist",
      systemImageName: "cart.badge.plus")
    AppShortcut(
      intent: ReadListIntent(),
      phrases: ["What's on my \(.applicationName)"],
      shortTitle: "Read my Snacklist",
      systemImageName: "list.bullet")
    AppShortcut(
      intent: OpenListIntent(),
      phrases: ["Show my \(.applicationName)"],
      shortTitle: "Open Snacklist",
      systemImageName: "checklist")
  }

  /// Requests for the system's own lists. Siri never hands these to Snacklist, whatever its fuzzy
  /// matching makes of them. One plain German translation each in AppShortcuts.xcstrings (job
  /// 170): the build log can't show whether a negative phrase's string set reaches Siri.
  static var negativePhrases: NegativeAppShortcutPhrases {
    NegativeAppShortcutPhrases(phrases: [
      "Add something to my shopping list",
      "Add to my shopping list",
      "Add to my groceries list",
      "What's on my shopping list",
      "Read my shopping list",
      "Remind me to buy something",
      "Add to my reminders",
    ])
  }
}

/// The same sentence as `full` (HomePod) and `supporting` (iPhone): see VoiceResult.answer.
private func dialog(_ answer: String) -> IntentDialog {
  IntentDialog(full: "\(answer)", supporting: "\(answer)")
}
