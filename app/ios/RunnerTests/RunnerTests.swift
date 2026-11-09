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

/// Job 25: Snacklist Lifetime against StoreKit's local test store (app/ios/Snacklist.storekit),
/// no App Store account or agreement needed. The ios gate runs them on an iOS 26.2 simulator,
/// whose storekitd takes the configuration from CI's ad-hoc build (DECISIONS 127).
final class LifetimeStoreKitTests: XCTestCase {
  let productId = "com.snacklist.app.lifetime"
  var session: SKTestSession!

  override func setUpWithError() throws {
    executionTimeAllowance = 60
    // The configuration file beside this folder; the simulator reads the host's file system.
    let url = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent()
      .appendingPathComponent("Snacklist.storekit")
    session = try SKTestSession(contentsOf: url)
    // storekitd refuses the configuration of an app it doesn't count as installed for development
    // (CI's ad-hoc signed build); the session's calls then fail only in the log and StoreKit
    // answers from the App Store sandbox, whose purchase sheet never returns (DECISIONS 127).
    // A session storekitd took reports the file's storefront.
    let config = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    let storefront = (config["settings"] as! [String: Any])["_storefront"] as! String
    guard session.storefront == storefront else {
      throw XCTSkip("storekitd did not take Snacklist.storekit (storefront '\(session.storefront)', want \(storefront)): the app is not installed for development (DECISIONS 127)")
    }
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

  func testTheProductIsANonConsumableAt2999WithoutFamilySharing() async throws {
    let p = try await lifetime()
    XCTAssertEqual(p.type, .nonConsumable)
    XCTAssertEqual(p.price, Decimal(string: "29.99"))
    XCTAssertEqual(p.displayName, "Snacklist Lifetime")
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
    // The refund reaches currentEntitlements a moment later, like the approval below.
    var afterRefund = await owned()
    for _ in 0..<20 where !afterRefund.isEmpty {
      try await Task.sleep(nanoseconds: 250_000_000)
      afterRefund = await owned()
    }
    let revoked = await Transaction.latest(for: productId).flatMap { try? $0.payloadValue.revocationDate }
    XCTAssertEqual(afterRefund, [], "a refund takes it away (revocation date: \(String(describing: revoked)))")
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
