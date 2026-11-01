package com.hummlist.app.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetPayloadTest {
    @Test
    fun readsTheContractsExample() {
        val raw = """
            {"version": 1, "state": "ready", "open": 9,
             "items": [
               {"name": "Hafermilch", "quantity": "2 l", "store": "Rewe"},
               {"name": "Äpfel", "quantity": null, "store": "Rewe"},
               {"name": "Brot", "quantity": null, "store": null}
             ],
             "updatedAt": "2026-11-01T21:30:00.000Z"}
        """
        assertEquals(
            WidgetPayload.Ready(
                open = 9,
                items = listOf(
                    WidgetItem("Hafermilch", "2 l", "Rewe"),
                    WidgetItem("Äpfel", null, "Rewe"),
                    WidgetItem("Brot", null, null),
                ),
            ),
            WidgetPayload.parse(raw),
        )
    }

    @Test
    fun readsTheSessionStates() {
        assertEquals(WidgetPayload.SignedOut, WidgetPayload.parse("""{"version": 1, "state": "signedOut"}"""))
        assertEquals(WidgetPayload.NoHousehold, WidgetPayload.parse("""{"version": 1, "state": "noHousehold"}"""))
    }

    @Test
    fun anEmptyListIsReadyWithNothingOpen() {
        assertEquals(
            WidgetPayload.Ready(0, emptyList()),
            WidgetPayload.parse("""{"version": 1, "state": "ready", "open": 0, "items": []}"""),
        )
    }

    @Test
    fun asksToOpenTheAppForAnythingElse() {
        listOf(
            null,
            "",
            "not json",
            "[]",
            """{"version": 2, "state": "ready", "open": 1, "items": []}""",
            """{"state": "signedOut"}""",
            """{"version": 1, "state": "somethingNew"}""",
            """{"version": 1, "state": "ready", "items": []}""",
            """{"version": 1, "state": "ready", "open": 1, "items": [{"quantity": "1"}]}""",
        ).forEach { assertEquals("for $it", WidgetPayload.NoData, WidgetPayload.parse(it)) }
    }

    @Test
    fun aStoresPillSitsOnTheFirstRowOfEachRun() {
        val items = listOf(
            WidgetItem("Hafermilch", "2 l", "Rewe"),
            WidgetItem("Äpfel", null, "Rewe"),
            WidgetItem("Zahnpasta", null, "dm"),
            WidgetItem("Brot", null, null),
            WidgetItem("Seife", null, "dm"),
        )
        assertEquals(
            listOf(true, false, true, false, true),
            widgetRows(items, 5).map { it.showsStore },
        )
    }

    @Test
    fun showsAtMostTheRowsThatFit() {
        val items = List(6) { WidgetItem("Item $it", null, null) }
        assertEquals(3, widgetRows(items, 3).size)
        assertEquals(6, widgetRows(items, 10).size)
    }
}
