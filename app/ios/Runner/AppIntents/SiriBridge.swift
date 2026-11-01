import Flutter
import Foundation

/// The `hummlist/siri` channel: lib/siri keeps the Keychain credential and the item suggestions
/// in step with the session. `read` never returns the token.
final class SiriBridge: NSObject, FlutterPlugin {
  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "hummlist/siri", binaryMessenger: registrar.messenger())
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
      let names = (call.arguments as? [String: Any])?["names"] as? [String] ?? []
      suggestions.save(names)
      Self.refreshShortcuts()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private static func refreshShortcuts() {
    if #available(iOS 17.0, *) {
      HummlistShortcuts.updateAppShortcutParameters()
    }
  }
}
