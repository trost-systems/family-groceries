import XCTest

@testable import Runner

/// Answers every request of a session built with it; records the last request and its body.
final class StubProtocol: URLProtocol {
  enum Reply {
    case http(Int, String)
    case failure(URLError.Code)
  }

  static var reply: Reply = .http(500, "")
  static var requests: [(request: URLRequest, body: Data)] = []

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    Self.requests.append((request, Self.body(of: request)))
    switch Self.reply {
    case .failure(let code):
      client?.urlProtocol(self, didFailWithError: URLError(code))
    case .http(let status, let body):
      let response = HTTPURLResponse(
        url: request.url!, statusCode: status, httpVersion: "HTTP/1.1",
        headerFields: ["content-type": "application/json"])!
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: Data(body.utf8))
      client?.urlProtocolDidFinishLoading(self)
    }
  }

  override func stopLoading() {}

  private static func body(of request: URLRequest) -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 4096)
    while stream.hasBytesAvailable {
      let read = stream.read(&buffer, maxLength: buffer.count)
      if read <= 0 { break }
      data.append(buffer, count: read)
    }
    return data
  }
}

final class VoiceClientTests: XCTestCase {
  let credential = SiriCredential(
    token: "fgp_test", id: "c1", userId: "u1", sessionId: "s1",
    url: URL(string: "https://example.supabase.co/functions/v1/voice")!)

  override func setUp() {
    StubProtocol.requests = []
  }

  private func client(signedIn: Bool = true) -> VoiceClient {
    let config = VoiceClient.configuration()
    config.protocolClasses = [StubProtocol.self]
    let credential = signedIn ? self.credential : nil
    return VoiceClient(session: URLSession(configuration: config)) { credential }
  }

  private func send(
    _ reply: StubProtocol.Reply, mode: VoiceMode = .add, lang: VoiceLanguage = .en
  ) async -> VoiceResult {
    StubProtocol.reply = reply
    return await client().send(text: mode == .add ? "milk, eggs and bread" : nil, mode: mode, lang: lang)
  }

  func testTheRequestCarriesTokenTextModeAndLanguage() async throws {
    _ = await send(.http(200, #"{"outcome":"added","speech":"Added milk."}"#), lang: .de)
    let (request, body) = try XCTUnwrap(StubProtocol.requests.last)
    XCTAssertEqual(request.url, credential.url)
    XCTAssertEqual(request.httpMethod, "POST")
    XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer fgp_test")
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
    XCTAssertEqual(json, ["text": "milk, eggs and bread", "mode": "add", "lang": "de"])
  }

  func testReadSendsNoText() async throws {
    _ = await send(.http(200, #"{"outcome":"read","speech":"Milk."}"#), mode: .read)
    let body = try XCTUnwrap(StubProtocol.requests.last?.body)
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
    XCTAssertEqual(json, ["mode": "read", "lang": "en"])
  }

  func testTheWholeRequestGivesUpAfterEightSeconds() {
    let config = VoiceClient.configuration()
    XCTAssertEqual(config.timeoutIntervalForRequest, 8)
    XCTAssertEqual(config.timeoutIntervalForResource, 8)
    XCTAssertFalse(config.waitsForConnectivity)
  }

  func testWithoutACredentialNothingIsSent() async {
    let result = await client(signedIn: false).send(text: "milk", mode: .add, lang: .en)
    XCTAssertEqual(result, .failed(.notSignedIn))
    XCTAssertTrue(StubProtocol.requests.isEmpty)
  }

  func testSuccessNeedsTheServersOutcome() async {
    let added = await send(.http(200, #"{"outcome":"added","speech":"Added milk, eggs and bread to Hummlist."}"#))
    XCTAssertEqual(added, .added(speech: "Added milk, eggs and bread to Hummlist."))
    let already = await send(.http(200, #"{"outcome":"nothing_added","speech":"Already on the list: milk."}"#))
    XCTAssertEqual(already, .nothingAdded(speech: "Already on the list: milk."))
    let read = await send(.http(200, #"{"outcome":"read","speech":"Milk and eggs.","items":[],"total":2}"#), mode: .read)
    XCTAssertEqual(read, .read(speech: "Milk and eggs."))
  }

  func testA200WithoutAKnownOutcomeIsNoSuccess() async {
    let cases = [
      #"{"speech":"Hinzugefügt: Milch."}"#,
      #"{"outcome":"parsed","speech":"Verstanden: Milch."}"#,
      #"{"outcome":"added"}"#,
      #"{"outcome":"added","speech":""}"#,
      "not json",
      "",
    ]
    for body in cases {
      let result = await send(.http(200, body))
      XCTAssertEqual(result, .failed(.noAnswer), body)
    }
    let readAsAdd = await send(.http(200, #"{"outcome":"read","speech":"Milk."}"#))
    XCTAssertEqual(readAsAdd, .failed(.noAnswer))
    let addAsRead = await send(.http(200, #"{"outcome":"added","speech":"Added milk."}"#), mode: .read)
    XCTAssertEqual(addAsRead, .failed(.noAnswer))
  }

  func testEachFailureCode() async {
    let cases: [(Int, String, VoiceFailure)] = [
      (401, #"{"outcome":"unauthorized","error":"unauthorized","speech":"x"}"#, .signedOut),
      (401, "", .signedOut),
      (403, #"{"outcome":"no_household","error":"no_household","speech":"x"}"#, .noHousehold),
      (400, #"{"outcome":"no_text","error":"no_text","speech":"x"}"#, .nothingUnderstood),
      (422, #"{"outcome":"nothing_understood","error":"nothing_understood","speech":"x"}"#, .nothingUnderstood),
      (413, #"{"outcome":"too_long","error":"too_long","speech":"x"}"#, .tooLong),
      (500, #"{"outcome":"server","error":"server","speech":"x"}"#, .server),
      (500, #"{"error":"server","speech":"x"}"#, .server),
      (502, "<html>Bad Gateway</html>", .noAnswer),
      (504, "", .noAnswer),
      (405, #"{"outcome":"method","error":"method","speech":"x"}"#, .noAnswer),
    ]
    for (status, body, failure) in cases {
      let result = await send(.http(status, body))
      XCTAssertEqual(result, .failed(failure), "\(status) \(body)")
    }
  }

  func testPremiumRequiredLocksAtAnyStatus() async {
    let speech = "Voice commands are part of Hummlist Premium. You can unlock it in the app under More, Hummlist Premium. I didn't add anything."
    for status in [200, 403, 402] {
      let result = await send(.http(status, #"{"outcome":"premium_required","error":"premium_required","speech":"\#(speech)"}"#))
      XCTAssertEqual(result, .lockedHousehold(speech: speech), "\(status)")
    }
    let bare = await send(.http(403, #"{"error":"premium_required"}"#))
    XCTAssertEqual(bare, .lockedHousehold(speech: nil))
  }

  func testNetworkFailures() async {
    let cases: [(URLError.Code, VoiceFailure)] = [
      (.notConnectedToInternet, .offline),
      (.cannotFindHost, .offline),
      (.cannotConnectToHost, .offline),
      (.dataNotAllowed, .offline),
      (.timedOut, .noAnswer),
      (.networkConnectionLost, .noAnswer),
      (.secureConnectionFailed, .noAnswer),
    ]
    for (code, failure) in cases {
      let result = await send(.failure(code))
      XCTAssertEqual(result, .failed(failure), "\(code)")
    }
  }
}

final class SiriAnswerTests: XCTestCase {
  func testEveryAddFailureSaysNothingWasAdded() {
    for lang in VoiceLanguage.allCases {
      let copy = SiriCopy(lang)
      for failure in VoiceFailure.allCases where failure != .noAnswer {
        let answer = VoiceResult.failed(failure).answer(mode: .add, copy: copy)
        XCTAssertTrue(answer.hasSuffix(copy[.nothingAdded]), "\(lang) \(failure): \(answer)")
      }
      let unknown = VoiceResult.failed(.noAnswer).answer(mode: .add, copy: copy)
      XCTAssertTrue(unknown.hasSuffix(copy[.notConfirmed]), "\(lang): \(unknown)")
    }
  }

  func testTheExactSentences() {
    let en = SiriCopy(.en), de = SiriCopy(.de)
    XCTAssertEqual(
      VoiceResult.failed(.signedOut).answer(mode: .add, copy: en),
      "Open Hummlist and sign in again. I didn't add anything.")
    XCTAssertEqual(
      VoiceResult.failed(.notSignedIn).answer(mode: .add, copy: de),
      "Öffne Hummlist und melde dich an. Ich habe nichts hinzugefügt.")
    XCTAssertEqual(
      VoiceResult.failed(.offline).answer(mode: .add, copy: en),
      "Hummlist can't reach the internet right now. I didn't add anything.")
    XCTAssertEqual(
      VoiceResult.failed(.offline).answer(mode: .read, copy: de),
      "Hummlist hat gerade keine Internetverbindung. Ich konnte deine Liste nicht vorlesen.")
    XCTAssertEqual(
      VoiceResult.added(speech: "Added milk to Hummlist.").answer(mode: .add, copy: en),
      "Added milk to Hummlist.")
  }

  func testALockedHouseholdHearsTheServerOrThePlaceholder() {
    let en = SiriCopy(.en), de = SiriCopy(.de)
    XCTAssertEqual(
      VoiceResult.lockedHousehold(speech: "Server words.").answer(mode: .add, copy: en),
      "Server words.")
    XCTAssertEqual(
      VoiceResult.lockedHousehold(speech: nil).answer(mode: .add, copy: de),
      "Sprachbefehle sind Teil von Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt.")
    XCTAssertEqual(
      VoiceResult.lockedHousehold(speech: nil).answer(mode: .add, copy: en),
      "Voice commands are part of Hummlist Premium. You can unlock it in the app under More, Hummlist Premium. I didn't add anything.")
  }

  func testEveryKeyIsTranslatedInBothLanguages() {
    let en = SiriCopy(.en), de = SiriCopy(.de)
    for key in SiriCopy.Key.allCases {
      XCTAssertNotEqual(en[key], key.rawValue, "en lacks \(key.rawValue)")
      XCTAssertNotEqual(de[key], key.rawValue, "de lacks \(key.rawValue)")
      XCTAssertNotEqual(en[key], de[key], "de is untranslated: \(key.rawValue)")
    }
  }

  func testDictatedTextPicksTheLanguage() {
    XCTAssertEqual(VoiceLanguage.of("Milch, Eier und Brot", localizations: ["en"]), .de)
    XCTAssertEqual(VoiceLanguage.of("milk, eggs and bread", localizations: ["de"]), .en)
    XCTAssertEqual(VoiceLanguage.of("zwei Gurken und eine Packung Eier", localizations: ["en"]), .de)
    XCTAssertEqual(VoiceLanguage.of("two cucumbers and a pack of eggs", localizations: ["de"]), .en)
  }

  func testWithoutClearTextTheAppsLocalizationDecides() {
    XCTAssertEqual(VoiceLanguage.of(nil, localizations: ["de"]), .de)
    XCTAssertEqual(VoiceLanguage.of("", localizations: ["de-AT", "en"]), .de)
    XCTAssertEqual(VoiceLanguage.of(nil, localizations: ["en"]), .en)
    XCTAssertEqual(VoiceLanguage.of(nil, localizations: ["fr"]), .en)
    XCTAssertEqual(VoiceLanguage.of(nil, localizations: []), .en)
    let oneWord = VoiceLanguage.of("Milch", localizations: ["en"])
    XCTAssertTrue([.de, .en].contains(oneWord), "one word may go either way")
  }
}

final class SiriStoreTests: XCTestCase {
  let store = SiriCredentialStore(service: "com.hummlist.app.siri.tests")

  override func tearDown() {
    store.clear()
  }

  func testTheKeychainRoundTrip() throws {
    XCTAssertNil(store.load())
    let first = SiriCredential(
      token: "fgp_one", id: "c1", userId: "u1", sessionId: "s1",
      url: URL(string: "https://example.supabase.co/functions/v1/voice")!)
    try store.save(first)
    XCTAssertEqual(store.load(), first)
    let second = SiriCredential(
      token: "fgp_two", id: "c2", userId: "u1", sessionId: "s2",
      url: URL(string: "http://127.0.0.1:57421/functions/v1/voice")!)
    try store.save(second)
    XCTAssertEqual(store.load(), second, "store overwrites")
    store.clear()
    XCTAssertNil(store.load())
  }

  func testTheItemIsOnlyReadableOnThisDeviceAfterFirstUnlock() throws {
    try store.save(SiriCredential(
      token: "fgp_one", id: "c1", userId: "u1", sessionId: "s1",
      url: URL(string: "https://example.supabase.co/functions/v1/voice")!))
    var found: CFTypeRef?
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: store.service,
      kSecAttrAccount as String: "credential",
      kSecReturnAttributes as String: true,
    ]
    XCTAssertEqual(SecItemCopyMatching(query as CFDictionary, &found), errSecSuccess)
    let attributes = try XCTUnwrap(found as? [String: Any])
    XCTAssertEqual(
      attributes[kSecAttrAccessible as String] as? String,
      kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
  }

  func testChannelArgumentsNeedEveryField() {
    let full: [String: Any] = [
      "token": "fgp_x", "id": "c", "userId": "u", "sessionId": "s",
      "url": "https://example.supabase.co/functions/v1/voice",
    ]
    XCTAssertNotNil(SiriCredential(arguments: full))
    for key in full.keys {
      var missing = full
      missing.removeValue(forKey: key)
      XCTAssertNil(SiriCredential(arguments: missing), "without \(key)")
    }
    var ftp = full
    ftp["url"] = "ftp://example.com/voice"
    XCTAssertNil(SiriCredential(arguments: ftp))
    XCTAssertNil(SiriCredential(arguments: nil))
  }

  func testSuggestionsAreTrimmedDedupedAndCapped() {
    let file = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString).appendingPathComponent("suggestions.json")
    let suggestions = ItemSuggestionStore(file: file)
    XCTAssertEqual(suggestions.names(), [])
    suggestions.save([" Milch ", "milch", "", "Eier"] + (1...60).map { "Item \($0)" })
    let names = suggestions.names()
    XCTAssertEqual(Array(names.prefix(2)), ["Milch", "Eier"])
    XCTAssertEqual(names.count, 50)
    suggestions.clear()
    XCTAssertEqual(suggestions.names(), [])
  }
}

/// The phrases in HummlistShortcuts against the AppShortcuts.strings the app ships (a string
/// catalog needs deployment target 17): each one is translated to en and de, keeps the app name,
/// and has at most one parameter.
final class AppShortcutPhraseTests: XCTestCase {
  private let runner = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Runner")

  private func codePhrases() throws -> [String] {
    let source = try String(contentsOf: runner.appendingPathComponent("AppIntents/HummlistIntents.swift"), encoding: .utf8)
    let literal = try NSRegularExpression(pattern: #""([^"\n]*\\\(\.applicationName\)[^"\n]*)""#)
    let range = NSRange(source.startIndex..., in: source)
    return literal.matches(in: source, range: range).map {
      String(source[Range($0.range(at: 1), in: source)!])
        .replacingOccurrences(of: #"\(.applicationName)"#, with: "${applicationName}")
        .replacingOccurrences(of: #"\(\.$item)"#, with: "${item}")
    }
  }

  private func placeholders(_ phrase: String) -> [String] {
    let pattern = try! NSRegularExpression(pattern: #"\$\{[A-Za-z]+\}"#)
    let range = NSRange(phrase.startIndex..., in: phrase)
    return pattern.matches(in: phrase, range: range).map { String(phrase[Range($0.range, in: phrase)!]) }.sorted()
  }

  func testEveryPhraseIsTranslatedToEnglishAndGerman() throws {
    let phrases = try codePhrases()
    XCTAssertGreaterThanOrEqual(phrases.count, 10)
    for phrase in phrases {
      XCTAssertTrue(phrase.contains("${applicationName}"), phrase)
      XCTAssertLessThanOrEqual(placeholders(phrase).filter { $0 != "${applicationName}" }.count, 1, phrase)
    }
    for lang in ["en", "de"] {
      let path = try XCTUnwrap(
        Bundle.main.path(forResource: "AppShortcuts", ofType: "strings", inDirectory: nil, forLocalization: lang),
        "the app ships \(lang).lproj/AppShortcuts.strings")
      let table = try XCTUnwrap(NSDictionary(contentsOfFile: path) as? [String: String], lang)
      XCTAssertEqual(Set(table.keys), Set(phrases), "\(lang) holds exactly the code's phrases")
      for (phrase, value) in table {
        XCTAssertEqual(placeholders(value), placeholders(phrase), "\(lang): \(value)")
      }
    }
  }

  func testAtMostTenAppShortcuts() throws {
    let source = try String(contentsOf: runner.appendingPathComponent("AppIntents/HummlistIntents.swift"), encoding: .utf8)
    let count = source.components(separatedBy: "AppShortcut(\n").count - 1
    XCTAssertGreaterThan(count, 0)
    XCTAssertLessThanOrEqual(count, 10)
  }

  func testTheAppShipsGermanAndEnglishStrings() {
    let main = Bundle.main
    let lprojs = (try? FileManager.default.contentsOfDirectory(atPath: main.bundlePath))?
      .filter { $0.hasSuffix(".lproj") } ?? []
    for lang in ["en", "de"] {
      XCTAssertNotNil(
        main.path(forResource: "Localizable", ofType: "strings", inDirectory: nil, forLocalization: lang),
        "\(lang) Localizable; bundle has \(lprojs)")
    }
  }
}
