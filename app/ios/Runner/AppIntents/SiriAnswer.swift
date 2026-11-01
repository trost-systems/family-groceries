import Foundation

/// The intents' own sentences (Localizable.xcstrings), looked up in the request's language so a
/// local answer never mixes languages with the server's speech.
struct SiriCopy {
  enum Key: String, CaseIterable {
    case askItems = "siri.ask.items"
    case notSignedIn = "siri.failure.notSignedIn"
    case signedOut = "siri.failure.signedOut"
    case noHousehold = "siri.failure.noHousehold"
    case offline = "siri.failure.offline"
    case noAnswer = "siri.failure.noAnswer"
    case nothingUnderstood = "siri.failure.nothingUnderstood"
    case tooLong = "siri.failure.tooLong"
    case server = "siri.failure.server"
    case nothingAdded = "siri.add.nothingAdded"
    case notConfirmed = "siri.add.notConfirmed"
    case listNotRead = "siri.read.notRead"
    case lockedHousehold = "siri.locked"
  }

  let lang: VoiceLanguage
  private let bundle: Bundle

  init(_ lang: VoiceLanguage, in main: Bundle = .main) {
    self.lang = lang
    bundle = main.path(forResource: lang.rawValue, ofType: "lproj").flatMap(Bundle.init(path:)) ?? main
  }

  subscript(key: Key) -> String {
    bundle.localizedString(forKey: key.rawValue, value: nil, table: nil)
  }
}

extension VoiceResult {
  /// One self-contained sentence for every device: HomePod speaks the dialog's `full` text and
  /// iPhone the `supporting` one, and with no snippet view both must carry the read-back or the
  /// "nothing was added".
  func answer(mode: VoiceMode, copy: SiriCopy) -> String {
    switch self {
    case .added(let speech), .nothingAdded(let speech), .read(let speech):
      return speech
    case .lockedHousehold(let speech):
      return speech ?? (mode == .add
        ? "\(copy[.lockedHousehold]) \(copy[.nothingAdded])" : copy[.lockedHousehold])
    case .failed(let failure):
      let reason = copy[failure.copyKey]
      switch (mode, failure) {
      case (.read, _): return "\(reason) \(copy[.listNotRead])"
      case (.add, .noAnswer): return "\(reason) \(copy[.notConfirmed])"
      case (.add, _): return "\(reason) \(copy[.nothingAdded])"
      }
    }
  }
}

extension VoiceFailure {
  var copyKey: SiriCopy.Key {
    switch self {
    case .notSignedIn: return .notSignedIn
    case .signedOut: return .signedOut
    case .noHousehold: return .noHousehold
    case .offline: return .offline
    case .noAnswer: return .noAnswer
    case .nothingUnderstood: return .nothingUnderstood
    case .tooLong: return .tooLong
    case .server: return .server
    }
  }
}
