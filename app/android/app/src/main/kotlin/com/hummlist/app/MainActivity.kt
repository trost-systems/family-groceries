package com.hummlist.app

import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryProductDetailsParams
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "familygroceries/speech")
            .setMethodCallHandler { call, result ->
                if (call.method == "offlineGerman") offlineGerman(result::success) else result.notImplemented()
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "familygroceries/posthog")
            .setMethodCallHandler { call, result ->
                val token = call.argument<String>("projectToken")
                if (call.method == "forget" && token != null) {
                    forgetPostHog(token)
                    result.success(null)
                } else {
                    result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "familygroceries/store_prices")
            .setMethodCallHandler { call, result ->
                val yearly = call.argument<String>("yearly")
                val lifetime = call.argument<String>("lifetime")
                val basePlan = call.argument<String>("basePlan")
                when {
                    call.method == "prices" && yearly != null && lifetime != null && basePlan != null ->
                        storePrices(yearly, lifetime, basePlan, result::success)
                    // Play has no in-app sheet: Dart opens Play's subscriptions page.
                    call.method == "manageSubscriptions" -> result.success(false)
                    else -> result.notImplemented()
                }
            }
    }

    /**
     * Deletes what posthog-android keeps after PostHog.close(): its preferences
     * (anonymous and device ids, flags, super properties), cleared through
     * Android's API because they are cached in memory too, and its queues.
     * Analytics calls it when the user switches analytics off (job 44).
     */
    private fun forgetPostHog(token: String) {
        getSharedPreferences("posthog-android-$token", MODE_PRIVATE).edit().clear().commit()
        listOf("posthog-disk-queue", "posthog-disk-replay-queue", "posthog-disk-logs-queue")
            .forEach { File(cacheDir, it).deleteRecursively() }
        getDir("app_posthog-disk-queue", MODE_PRIVATE).deleteRecursively()
    }

    /**
     * Whether speech_to_text's onDevice listening gets the on-device recognizer
     * (otherwise it silently uses the network one) and that recognizer has German.
     */
    private fun offlineGerman(answer: (Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
        ) {
            answer(false)
            return
        }
        // Android 12 can't list on-device languages. Without German, listening
        // fails with ERROR_LANGUAGE_UNAVAILABLE, which the app explains the same way.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            answer(true)
            return
        }
        val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        recognizer.checkRecognitionSupport(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH),
            mainExecutor,
            object : RecognitionSupportCallback {
                override fun onSupportResult(support: RecognitionSupport) {
                    recognizer.destroy()
                    answer(support.installedOnDeviceLanguages.any { it.startsWith("de") })
                }

                override fun onError(error: Int) {
                    recognizer.destroy()
                    answer(false)
                }
            },
        )
    }

    /**
     * lib/purchases/store_prices.dart's prices, read from Play Billing before
     * the user taps Buy (Legal Review A2-5): the yearly base plan's recurring
     * price and Lifetime's one-time price, null for a product Play does not
     * sell here, and null for the whole answer on any failure. A client of its
     * own per read, ended once answered, so nothing stays connected.
     */
    private fun storePrices(
        yearly: String,
        lifetime: String,
        basePlan: String,
        answer: (Map<String, Map<String, String>?>?) -> Unit,
    ) {
        val client = BillingClient.newBuilder(applicationContext)
            // This client never purchases (purchases go through RevenueCat), so
            // there is nothing to hear; Play requires a listener all the same.
            .setListener { _, _ -> }
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
        val main = Handler(Looper.getMainLooper())
        var replied = false
        // Billing's callbacks may come on another thread, and a disconnect can
        // follow the answer: Flutter takes one reply, on the main thread.
        fun reply(prices: Map<String, Map<String, String>?>?) {
            main.post {
                if (!replied) {
                    replied = true
                    client.endConnection()
                    answer(prices)
                }
            }
        }
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(setup: BillingResult) {
                if (setup.responseCode != BillingClient.BillingResponseCode.OK) {
                    reply(null)
                    return
                }
                // One product type per query: Play rejects mixed lists.
                query(client, yearly, BillingClient.ProductType.SUBS) { subscription ->
                    if (subscription == null) {
                        reply(null)
                    } else {
                        query(client, lifetime, BillingClient.ProductType.INAPP) { oneTime ->
                            reply(
                                oneTime?.let {
                                    mapOf(
                                        "yearly" to subscription.firstOrNull()?.let { p -> yearlyPrice(p, basePlan) },
                                        "lifetime" to oneTime.firstOrNull()?.let { p -> lifetimePrice(p) },
                                    )
                                },
                            )
                        }
                    }
                }
            }

            override fun onBillingServiceDisconnected() {
                reply(null)
            }
        })
    }

    /** The product's details, empty when Play does not sell it, null on failure. */
    private fun query(
        client: BillingClient,
        productId: String,
        type: String,
        done: (List<ProductDetails>?) -> Unit,
    ) {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(type)
                        .build(),
                ),
            )
            .build()
        client.queryProductDetailsAsync(params) { billing, result ->
            // A product Play does not find or offer here lands in
            // result.unfetchedProductList: not sold, not a failure.
            done(
                if (billing.responseCode == BillingClient.BillingResponseCode.OK) {
                    result.productDetailsList.filter { it.productId == productId }
                } else {
                    null
                },
            )
        }
    }

    /** The base plan's own offer (no offerId), at its recurring phase's price. */
    private fun yearlyPrice(product: ProductDetails, basePlan: String): Map<String, String>? =
        product.subscriptionOfferDetails
            ?.firstOrNull { it.basePlanId == basePlan && it.offerId == null }
            ?.pricingPhases?.pricingPhaseList?.lastOrNull()
            ?.let { mapOf("price" to it.formattedPrice, "currency" to it.priceCurrencyCode) }

    private fun lifetimePrice(product: ProductDetails): Map<String, String>? =
        product.oneTimePurchaseOfferDetails
            ?.let { mapOf("price" to it.formattedPrice, "currency" to it.priceCurrencyCode) }
}
