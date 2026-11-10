import Flutter
import Foundation
import Intents

/// The `snacklist/siri` channel: lib/siri keeps the Keychain credential and the item suggestions
/// in step with the session. `read` never returns the token.
final class SiriBridge: NSObject, FlutterPlugin {
  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "snacklist/siri", binaryMessenger: registrar.messenger())
    registrar.addMethodCallDelegate(SiriBridge(), channel: channel)
  }

  private let credentials = SiriCredentialStore()
  private let suggestions = ItemSuggestionStore()

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "store":
      guard let credential = SiriCredential(arguments: call.arguments) else {
        return result(FlutterError(code: "bad_args", message: "incomplete credential", details: nil))
      }
      do {
        try credentials.save(credential)
        Self.askForSiri()
        result(nil)
      } catch let failure as SiriCredentialStore.Failure {
        result(FlutterError(code: "keychain", message: "status \(failure.status)", details: nil))
      } catch {
        result(FlutterError(code: "keychain", message: nil, details: nil))
      }
    case "read":
      result(credentials.load().map { ["id": $0.id, "userId": $0.userId, "sessionId": $0.sessionId] })
    case "clear":
      credentials.clear()
      suggestions.clear()
      Self.refreshShortcuts()
      result(nil)
    case "suggestions":
      let items = (call.arguments as? [String: Any])?["items"] as? [Any] ?? []
      suggestions.save(items.compactMap(ItemSuggestionStore.Entry.init(argument:)))
      Self.refreshShortcuts()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  /// SiriKit hands the app its Lists intents only once the user allowed Siri for it. Asked once,
  /// when the app first sets Siri up (signed in, in a household); the answer lives in Settings.
  private static func askForSiri() {
    if INPreferences.siriAuthorizationStatus() == .notDetermined {
      INPreferences.requestSiriAuthorization { _ in }
    }
  }

  private static func refreshShortcuts() {
    SnacklistShortcuts.updateAppShortcutParameters()
  }
}
