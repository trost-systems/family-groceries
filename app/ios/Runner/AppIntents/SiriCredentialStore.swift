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

  var service = "com.snacklist.app.siri"
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

/// The household's known items for the "Add <item> to Snacklist" phrases: at most 50 names, each
/// with at most two synonyms, at most 100 spoken values in all. Apple caps an app at 1,000 phrases
/// with every parameter value expanded, and the busiest language has six item phrases. Not
/// secret; a file in Application Support rather than the Keychain, and not UserDefaults, which
/// would need a privacy-manifest reason.
struct ItemSuggestionStore {
  struct Entry: Codable, Equatable {
    let name: String
    var synonyms: [String] = []

    /// A build before job 97 saved bare names.
    init(from decoder: Decoder) throws {
      if let name = try? decoder.singleValueContainer().decode(String.self) {
        self.init(name: name)
        return
      }
      let container = try decoder.container(keyedBy: CodingKeys.self)
      self.init(
        name: try container.decode(String.self, forKey: .name),
        synonyms: try container.decodeIfPresent([String].self, forKey: .synonyms) ?? [])
    }

    init(name: String, synonyms: [String] = []) {
      self.name = name
      self.synonyms = synonyms
    }

    /// The method channel's `{name, synonyms}` map; nil without a name.
    init?(argument: Any) {
      guard let map = argument as? [String: Any], let name = map["name"] as? String else { return nil }
      self.init(name: name, synonyms: map["synonyms"] as? [String] ?? [])
    }
  }

  static let limit = 50
  static let synonymLimit = 2
  static let spokenLimit = 100

  var file: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("siri-suggestions.json")

  func entries() -> [Entry] {
    guard let data = try? Data(contentsOf: file) else { return [] }
    return (try? JSONDecoder().decode([Entry].self, from: data)) ?? []
  }

  /// Trimmed, each spoken value once (case-insensitive, names before synonyms), within the caps.
  func save(_ entries: [Entry]) {
    var seen = Set<String>()
    func clean(_ value: String) -> String? {
      let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
      return !trimmed.isEmpty && seen.insert(trimmed.lowercased()).inserted ? trimmed : nil
    }
    var kept: [Entry] = []
    var sources: [Entry] = []
    for entry in entries where kept.count < Self.limit {
      if let name = clean(entry.name) {
        kept.append(Entry(name: name))
        sources.append(entry)
      }
    }
    var spoken = kept.count
    for index in kept.indices {
      for synonym in sources[index].synonyms {
        guard spoken < Self.spokenLimit, kept[index].synonyms.count < Self.synonymLimit else { break }
        if let synonym = clean(synonym) {
          kept[index].synonyms.append(synonym)
          spoken += 1
        }
      }
    }
    guard let data = try? JSONEncoder().encode(kept) else { return }
    try? FileManager.default.createDirectory(
      at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  func clear() {
    try? FileManager.default.removeItem(at: file)
  }
}
