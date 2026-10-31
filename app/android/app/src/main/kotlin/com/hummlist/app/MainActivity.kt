package com.hummlist.app

import android.content.Intent
import android.os.Build
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
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
}
