import java.util.Properties

plugins {
    id("com.android.application")
    // The Home Screen widget is Jetpack Glance (Compose); the compiler plugin matches Kotlin.
    id("org.jetbrains.kotlin.plugin.compose")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.hummlist.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.hummlist.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // Release builds sign with the upload key named in android/key.properties
    // (written by the release workflow from secrets, never committed). Without
    // the file they sign with the debug key, so local release builds still work.
    val keyProperties = Properties()
    val keyPropertiesFile = rootProject.file("key.properties")
    if (keyPropertiesFile.exists()) {
        keyPropertiesFile.inputStream().use { keyProperties.load(it) }
        signingConfigs {
            create("upload") {
                storeFile = file(keyProperties.getProperty("storeFile"))
                storePassword = keyProperties.getProperty("storePassword")
                keyAlias = keyProperties.getProperty("keyAlias")
                keyPassword = keyProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(
                if (keyPropertiesFile.exists()) "upload" else "debug",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    // MainActivity's price reader (job 49). Must be the Play Billing version
    // purchases-android brings (RevenueCat 11.0.0: 9.1.0), or Gradle resolves
    // one library for both and RevenueCat runs on a version it was not built for.
    implementation("com.android.billingclient:billing:9.1.0")
    // The Home Screen widget (job 63): the Glance version home_widget 0.10.0 is built against.
    implementation("androidx.glance:glance-appwidget:1.2.0")
    testImplementation("junit:junit:4.13.2")
    // android.jar's org.json is a stub on the JVM; the payload parser's tests need the real one.
    testImplementation("org.json:json:20250517")
    // posthog_flutter takes posthog-android [3.72.9, 4.0.0); a release build gets
    // the version job 44 checked (docs/DECISIONS.md, Job 44).
    constraints {
        implementation("com.posthog:posthog-android") { version { strictly("3.75.0") } }
    }
}
