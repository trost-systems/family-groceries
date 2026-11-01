import Foundation
import Security

/// The "Siri on this iPhone" credential the app creates after sign-in (lib/siri), kept as the
/// Keychain JSON the contract names. The token never goes back to Dart.
struct SiriCredential: Codable, Equatable {
  let token: String
  let id: String
  let userId: String
  let sessionId: String
  let url: URL

  /// Parses the method channel's `store` arguments; nil unless every field is present and the
  /// url is http(s).
  init?(arguments: Any?) {
    guard let map = arguments as? [String: Any],
      let token = map["token"] as? String, !token.isEmpty,
      let id = map["id"] as? String, !id.isEmpty,
      let userId = map["userId"] as? String, !userId.isEmpty,
      let sessionId = map["sessionId"] as? String, !sessionId.isEmpty,
      let raw = map["url"] as? String, let url = URL(string: raw),
      url.scheme == "https" || url.scheme == "http", url.host != nil
    else { return nil }
    self.init(token: token, id: id, userId: userId, sessionId: sessionId, url: url)
  }

  init(token: String, id: String, userId: String, sessionId: String, url: URL) {
    self.token = token
    self.id = id
    self.userId = userId
    self.sessionId = sessionId
    self.url = url
  }
}

struct SiriCredentialStore {
  struct Failure: Error, Equatable {
    let status: OSStatus
  }

  var service = "com.hummlist.app.siri"
  var account = "credential"

  private var query: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }

  func save(_ credential: SiriCredential) throws {
    let data = try JSONEncoder().encode(credential)
    SecItemDelete(query as CFDictionary)
    var item = query
    item[kSecValueData as String] = data
    item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(item as CFDictionary, nil)
    guard status == errSecSuccess else { throw Failure(status: status) }
  }

  func load() -> SiriCredential? {
    var lookup = query
    lookup[kSecReturnData as String] = true
    lookup[kSecMatchLimit as String] = kSecMatchLimitOne
    var found: CFTypeRef?
    guard SecItemCopyMatching(lookup as CFDictionary, &found) == errSecSuccess,
      let data = found as? Data
    else { return nil }
    return try? JSONDecoder().decode(SiriCredential.self, from: data)
  }

  func clear() {
    SecItemDelete(query as CFDictionary)
  }
}

/// The household's usual items (names only, at most 50) for the "Add <item> to Hummlist"
/// phrase. Not secret; a file in Application Support rather than the Keychain, and not
/// UserDefaults, which would need a privacy-manifest reason.
struct ItemSuggestionStore {
  static let limit = 50

  var file: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("siri-suggestions.json")

  func names() -> [String] {
    guard let data = try? Data(contentsOf: file) else { return [] }
    return (try? JSONDecoder().decode([String].self, from: data)) ?? []
  }

  func save(_ names: [String]) {
    var seen = Set<String>()
    let cleaned = names
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
    guard let data = try? JSONEncoder().encode(Array(cleaned.prefix(Self.limit))) else { return }
    try? FileManager.default.createDirectory(
      at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  func clear() {
    try? FileManager.default.removeItem(at: file)
  }
}
