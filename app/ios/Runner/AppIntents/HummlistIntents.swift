import AppIntents
import Foundation

/// Adds what the user says to the household's list through `voice`. Runs in the background:
/// the answer is Siri's dialog, the app never comes forward.
@available(iOS 17.0, *)
struct AddItemsIntent: AppIntent {
  static let title: LocalizedStringResource = "Add to Hummlist"
  static let description = IntentDescription("Adds items to your household's Hummlist.")

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .background }

  @Parameter(title: "Items")
  var text: String?

  @Parameter(title: "Item")
  var item: ItemSuggestion?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let client = VoiceClient.live()
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
    let result = await client.send(text: spoken, mode: .add, lang: lang)
    return .result(dialog: dialog(result.answer(mode: .add, copy: SiriCopy(lang))))
  }
}

/// Reads the open items of the household's list (the server caps what it says).
@available(iOS 17.0, *)
struct ReadListIntent: AppIntent {
  static let title: LocalizedStringResource = "Read my Hummlist"
  static let description = IntentDescription("Reads the open items on your household's Hummlist.")

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .background }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let lang = VoiceLanguage.of(nil)
    let result = await VoiceClient.live().send(text: nil, mode: .read, lang: lang)
    return .result(dialog: dialog(result.answer(mode: .read, copy: SiriCopy(lang))))
  }
}

/// One of the household's usual items, the value of "Add <item> to Hummlist". The app hands
/// the names over (`hummlist/siri` `suggestions`); its id is the name itself.
@available(iOS 17.0, *)
struct ItemSuggestion: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Item")
  static let defaultQuery = ItemSuggestionQuery()

  let id: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(stringLiteral: id)
  }
}

@available(iOS 17.0, *)
struct ItemSuggestionQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [ItemSuggestion] {
    identifiers.map(ItemSuggestion.init(id:))
  }

  func entities(matching string: String) async throws -> [ItemSuggestion] {
    ItemSuggestionStore().names()
      .filter { $0.localizedCaseInsensitiveContains(string) }
      .map(ItemSuggestion.init(id:))
  }

  func suggestedEntities() async throws -> [ItemSuggestion] {
    ItemSuggestionStore().names().map(ItemSuggestion.init(id:))
  }
}

/// The phrases. Each needs the app name, at most one parameter (an entity), and an entry in
/// en.lproj and de.lproj AppShortcuts.strings (RunnerTests and scripts/siri-phrases.ts check
/// that). A .strings table maps one phrase to one translation, so the German variants with an
/// article ("zur Hummlist") come with English phrases of their own.
///
/// The phrases without an item come first: Siri then asks for the items, which works for any
/// item, while an `item` phrase matches only the names the app suggested. German phrases name the
/// app first or as the object ("Hummlist, füge etwas hinzu"), never "Einkaufsliste" or a bare
/// "auf meine Hummlist": those are Reminders' grammar, and Reminders wins (job 92).
@available(iOS 17.0, *)
struct HummlistShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddItemsIntent(),
      phrases: [
        "Add to \(.applicationName)",
        "\(.applicationName) add",
        "Add something to my \(.applicationName)",
        "Shop with \(.applicationName)",
        "Add something to \(.applicationName)",
        "Add to my \(.applicationName)",
        "Put something on \(.applicationName)",
        "Put something on my \(.applicationName)",
        "\(.applicationName) add something",
        "Add \(\.$item) to \(.applicationName)",
        "Add \(\.$item) to my \(.applicationName)",
        "Put \(\.$item) on \(.applicationName)",
        "\(.applicationName) add \(\.$item)",
        "Put \(\.$item) on my \(.applicationName)",
      ],
      shortTitle: "Add to Hummlist",
      systemImageName: "cart.badge.plus")
    AppShortcut(
      intent: ReadListIntent(),
      phrases: [
        "\(.applicationName) what's on the list",
        "What's on my \(.applicationName)",
        "What's on \(.applicationName)",
        "Read my \(.applicationName)",
        "Read \(.applicationName)",
        "What's on the \(.applicationName)",
      ],
      shortTitle: "Read my Hummlist",
      systemImageName: "list.bullet")
  }
}

/// The same sentence as `full` (HomePod) and `supporting` (iPhone): see VoiceResult.answer.
@available(iOS 17.0, *)
private func dialog(_ answer: String) -> IntentDialog {
  IntentDialog(full: "\(answer)", supporting: "\(answer)")
}
