package com.hummlist.app.widget

import org.json.JSONException
import org.json.JSONObject

/** One open item as the app wrote it; [store] is the store's full name. */
data class WidgetItem(val name: String, val quantity: String?, val store: String?)

/** What the widget shows: the app's `hummlist_widget` string, version 1 (docs/HOME_WIDGETS.md). */
sealed interface WidgetPayload {
    /** No payload yet, an unreadable one or another version: ask the user to open Hummlist. */
    data object NoData : WidgetPayload

    data object SignedOut : WidgetPayload

    data object NoHousehold : WidgetPayload

    /** [open] counts every open item on the list; [items] are the first few in list order. */
    data class Ready(val open: Int, val items: List<WidgetItem>) : WidgetPayload

    companion object {
        /** The key the app writes into home_widget's HomeWidgetPreferences. */
        const val KEY = "hummlist_widget"

        fun parse(raw: String?): WidgetPayload {
            if (raw == null) return NoData
            return try {
                val json = JSONObject(raw)
                if (json.opt("version") != 1) return NoData
                when (json.optString("state")) {
                    "signedOut" -> SignedOut
                    "noHousehold" -> NoHousehold
                    "ready" -> Ready(
                        open = json.getInt("open").coerceAtLeast(0),
                        items = json.optJSONArray("items")?.let { array ->
                            (0 until array.length()).map { item(array.getJSONObject(it)) }
                        } ?: emptyList(),
                    )
                    else -> NoData
                }
            } catch (_: JSONException) {
                NoData
            }
        }

        private fun item(json: JSONObject) = WidgetItem(
            name = json.getString("name"),
            quantity = json.text("quantity"),
            store = json.text("store"),
        )

        private fun JSONObject.text(key: String): String? =
            if (isNull(key)) null else getString(key).takeIf { it.isNotBlank() }
    }
}

/** A row the widget draws: the item, and whether its store's pill goes on it. */
data class WidgetRow(val item: WidgetItem, val showsStore: Boolean)

/**
 * The first [max] items as rows. A store's pill sits on the first row of each run of the same
 * store, so a run the widget cuts into still starts with its pill.
 */
fun widgetRows(items: List<WidgetItem>, max: Int): List<WidgetRow> =
    items.take(max.coerceAtLeast(0)).mapIndexed { i, item ->
        WidgetRow(item, item.store != null && (i == 0 || items[i - 1].store != item.store))
    }
