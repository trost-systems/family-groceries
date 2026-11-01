import Foundation
import NaturalLanguage

/// The language of one request: the server answers in it and the local copy follows it.
enum VoiceLanguage: String, CaseIterable {
  case de, en

  /// The iOS 26 SDK can't tell an intent Siri's language, but Siri transcribes in it: dictated
  /// text that is clearly English or German decides. Otherwise (no text, one word, a name) the
  /// app's localization iOS picked for this process does.
  static func of(
    _ dictated: String?, localizations: [String] = Bundle.main.preferredLocalizations
  ) -> VoiceLanguage {
    if let dictated, !dictated.isEmpty {
      let recognizer = NLLanguageRecognizer()
      recognizer.languageConstraints = [.english, .german]
      recognizer.processString(dictated)
      if let (language, probability) = recognizer.languageHypotheses(withMaximum: 1).first,
        probability >= 0.7
      {
        return language == .german ? .de : .en
      }
    }
    return localizations.first?.lowercased().hasPrefix("de") == true ? .de : .en
  }
}

enum VoiceMode: String {
  case add, read
}

/// Why a request did not do what was asked. `noAnswer` is the one case where the server may have
/// added the items anyway (a timeout, a dropped connection, a reply without a known outcome).
enum VoiceFailure: String, CaseIterable {
  case notSignedIn, signedOut, noHousehold, offline, noAnswer, nothingUnderstood, tooLong, server
}

enum VoiceResult: Equatable {
  case added(speech: String)
  case nothingAdded(speech: String)
  case read(speech: String)
  case lockedHousehold(speech: String?)
  case failed(VoiceFailure)
}

/// Talks to the `voice` edge function with the Siri credential. Branches on the reply's
/// `outcome` (or `error`), never on its wording.
struct VoiceClient {
  static let timeout: TimeInterval = 8

  let session: URLSession
  let credential: () -> SiriCredential?

  static func configuration() -> URLSessionConfiguration {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = timeout
    config.timeoutIntervalForResource = timeout
    config.waitsForConnectivity = false
    config.urlCache = nil
    return config
  }

  static func live() -> VoiceClient {
    VoiceClient(session: URLSession(configuration: configuration())) {
      SiriCredentialStore().load()
    }
  }

  func send(text: String?, mode: VoiceMode, lang: VoiceLanguage) async -> VoiceResult {
    guard let credential = credential() else { return .failed(.notSignedIn) }
    var request = URLRequest(url: credential.url, timeoutInterval: Self.timeout)
    request.httpMethod = "POST"
    request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    var body = ["mode": mode.rawValue, "lang": lang.rawValue]
    if let text { body["text"] = text }
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await session.data(for: request)
    } catch let error as URLError {
      return .failed(Self.failure(for: error.code))
    } catch {
      return .failed(.noAnswer)
    }
    guard let http = response as? HTTPURLResponse else { return .failed(.noAnswer) }
    return Self.result(status: http.statusCode, body: data, mode: mode)
  }

  static func failure(for code: URLError.Code) -> VoiceFailure {
    switch code {
    case .notConnectedToInternet, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed,
      .dataNotAllowed, .internationalRoamingOff, .callIsActive:
      return .offline
    default:
      return .noAnswer
    }
  }

  private struct Reply: Decodable {
    let outcome: String?
    let error: String?
    let speech: String?
  }

  static func result(status: Int, body: Data, mode: VoiceMode) -> VoiceResult {
    let reply = try? JSONDecoder().decode(Reply.self, from: body)
    let code = reply?.outcome ?? reply?.error
    let speech = reply?.speech.flatMap { $0.isEmpty ? nil : $0 }

    if code == "premium_required" { return .lockedHousehold(speech: speech) }
    if status == 401 { return .failed(.signedOut) }
    if status == 200, let speech {
      switch (mode, code) {
      case (.add, "added"): return .added(speech: speech)
      case (.add, "nothing_added"): return .nothingAdded(speech: speech)
      case (.read, "read"): return .read(speech: speech)
      default: return .failed(.noAnswer)
      }
    }
    switch code {
    case "unauthorized": return .failed(.signedOut)
    case "no_household": return .failed(.noHousehold)
    case "no_text", "nothing_understood": return .failed(.nothingUnderstood)
    case "too_long": return .failed(.tooLong)
    case "server": return .failed(.server)
    default: return .failed(.noAnswer)
    }
  }
}
