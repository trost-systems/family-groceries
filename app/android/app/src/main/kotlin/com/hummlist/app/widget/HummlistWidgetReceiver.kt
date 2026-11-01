package com.hummlist.app.widget

import android.content.Context
import es.antonborri.home_widget.HomeWidgetGlanceWidgetReceiver

/** The widget's provider; the app's updateWidget names it as com.hummlist.app.widget.HummlistWidgetReceiver. */
class HummlistWidgetReceiver : HomeWidgetGlanceWidgetReceiver<HummlistWidget>() {
    override val glanceAppWidget = HummlistWidget()

    // The picker preview is a fixed sample in the device's language; bump the number when the
    // sample or the layout changes so home_widget registers the preview again.
    override fun previewFingerprint(context: Context): String =
        "1:${context.resources.configuration.locales[0].toLanguageTag()}"
}
