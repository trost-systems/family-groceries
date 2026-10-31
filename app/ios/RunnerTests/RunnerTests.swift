import Flutter
import StoreKit
import StoreKitTest
import UIKit
import XCTest

class RunnerTests: XCTestCase {

  func testExample() {
    // If you add code to the Runner application, consider adding tests here.
    // See https://developer.apple.com/documentation/xctest for more information about using XCTest.
  }

}

/// Job 25: Hummlist Lifetime against StoreKit's local test store (app/ios/Hummlist.storekit),
/// no App Store account or agreement needed. Run by scripts/ios-storekit-test.sh on a Mac.
@available(iOS 16.0, *)
final class LifetimeStoreKitTests: XCTestCase {
  let productId = "com.hummlist.app.lifetime"
  var session: SKTestSession!

  override func setUpWithError() throws {
    // The configuration file beside this folder; the simulator reads the host's file system.
    let url = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent()
      .appendingPathComponent("Hummlist.storekit")
    session = try SKTestSession(contentsOf: url)
    session.resetToDefaultState()
    session.disableDialogs = true
    session.clearTransactions()
  }

  private func lifetime() async throws -> Product {
    let products = try await Product.products(for: [productId])
    XCTAssertEqual(products.map(\.id), [productId], "the product loads")
    return products[0]
  }

  private func owned() async -> [String] {
    var ids: [String] = []
    for await result in Transaction.currentEntitlements {
      if case .verified(let t) = result { ids.append(t.productID) }
    }
    return ids
  }

  func testTheProductIsANonConsumableAt999WithoutFamilySharing() async throws {
    let p = try await lifetime()
    XCTAssertEqual(p.type, .nonConsumable)
    XCTAssertEqual(p.price, Decimal(string: "9.99"))
    XCTAssertEqual(p.displayName, "Hummlist Lifetime")
    XCTAssertFalse(p.isFamilyShareable)
  }

  func testPurchaseRestoreRefund() async throws {
    let p = try await lifetime()
    let result = try await p.purchase()
    guard case .success(let verification) = result, case .verified(let t) = verification else {
      return XCTFail("purchase did not succeed: \(result)")
    }
    // StoreKit's signed transaction (RevenueCat reads it on device): a compact JWS with an ES256 x5c header.
    let parts = verification.jwsRepresentation.split(separator: ".")
    XCTAssertEqual(parts.count, 3)
    var b64 = String(parts[0]).replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    b64 += String(repeating: "=", count: (4 - b64.count % 4) % 4)
    let header = try JSONSerialization.jsonObject(with: Data(base64Encoded: b64)!) as! [String: Any]
    XCTAssertEqual(header["alg"] as? String, "ES256")
    XCTAssertNotNil(header["x5c"], "the header carries the certificate chain")
    XCTAssertEqual(t.productID, productId)
    // Xcode's own signing: a local StoreKit test transaction, not one from the App Store.
    XCTAssertEqual(t.environment, .xcode)
    await t.finish()

    let restored = await owned()
    XCTAssertEqual(restored, [productId], "restore finds the purchase")

    try session.refundTransaction(identifier: UInt(t.id))
    let afterRefund = await owned()
    XCTAssertEqual(afterRefund, [], "a refund takes it away")
  }

  func testAskToBuyIsPendingUntilApproved() async throws {
    session.askToBuyEnabled = true
    let p = try await lifetime()
    let result = try await p.purchase()
    guard case .pending = result else { return XCTFail("want pending, got \(result)") }
    let pending = await owned()
    XCTAssertEqual(pending, [], "nothing owned while waiting for approval")
    let waiting = try XCTUnwrap(session.allTransactions().last)
    try session.approveAskToBuyTransaction(identifier: waiting.identifier)
    var approved: [String] = []
    for _ in 0..<20 where approved.isEmpty {
      approved = await owned()
      if approved.isEmpty { try await Task.sleep(nanoseconds: 250_000_000) }
    }
    XCTAssertEqual(approved, [productId], "approval completes the purchase")
  }
}
