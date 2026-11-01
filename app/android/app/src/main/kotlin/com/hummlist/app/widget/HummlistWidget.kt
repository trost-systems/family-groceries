package com.hummlist.app.widget

import android.content.Context
import android.net.Uri
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.hummlist.app.MainActivity
import com.hummlist.app.R
import es.antonborri.home_widget.HomeWidgetGlanceState
import es.antonborri.home_widget.HomeWidgetGlanceStateDefinition
import es.antonborri.home_widget.actionStartActivity

/** The links lib/home_widget/widget_launch.dart maps (docs/HOME_WIDGETS.md, "Taps"). */
private val OPEN_URI = Uri.parse("hummlist-widget://open/?homeWidget")
private val ADD_URI = Uri.parse("hummlist-widget://add/?homeWidget")

private val MEDIUM_WIDTH = 250.dp

/** Two widths (2 cells, 4 cells) times three heights, so the row count follows the height. */
private val SIZES = setOf(110.dp, MEDIUM_WIDTH).flatMap { w ->
    listOf(110.dp, 160.dp, 210.dp).map { h -> DpSize(w, h) }
}.toSet()

// Heights the row budget is counted from: the padding, the count (or the count and Add), the
// "+N more" line and one item row.
private val PADDING = 12.dp
private val HEADER = 38.dp
private val FOOTER = 18.dp
private val ROW = 22.dp

/**
 * Hummlist on the Android Home Screen: how many items are open and the next few. It draws only
 * what the app last wrote (WidgetPayload) and opens the app on a tap; it never changes the list.
 */
class HummlistWidget : GlanceAppWidget() {
    override val stateDefinition = HomeWidgetGlanceStateDefinition()

    override val sizeMode = SizeMode.Responsive(SIZES)

    override val previewSizeMode = SizeMode.Responsive(SIZES)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val preferences = currentState<HomeWidgetGlanceState>().preferences
            Content(WidgetPayload.parse(preferences.getString(WidgetPayload.KEY, null)))
        }
    }

    /** The widget picker (Android 15+) shows a sample list, never the user's own. */
    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent { Content(previewPayload(context)) }
    }
}

private fun previewPayload(context: Context): WidgetPayload {
    val names = context.resources.getStringArray(R.array.widget_preview_names)
    val quantities = context.resources.getStringArray(R.array.widget_preview_quantities)
    val stores = context.resources.getStringArray(R.array.widget_preview_stores)
    return WidgetPayload.Ready(
        open = 9,
        items = names.indices.map {
            WidgetItem(names[it], quantities[it].ifEmpty { null }, stores[it].ifEmpty { null })
        },
    )
}

private fun color(id: Int) = ColorProvider(id)

@Composable
private fun Content(payload: WidgetPayload) {
    val context = LocalContext.current
    val size = LocalSize.current
    val medium = size.width >= MEDIUM_WIDTH
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .background(color(R.color.hl_surface))
            .cornerRadius(android.R.dimen.system_app_widget_background_radius)
            .padding(PADDING)
            .clickable(actionStartActivity<MainActivity>(context, OPEN_URI)),
    ) {
        when (payload) {
            WidgetPayload.NoData -> Prompt(R.string.widget_no_data)
            WidgetPayload.SignedOut -> Prompt(R.string.widget_signed_out)
            WidgetPayload.NoHousehold -> Prompt(R.string.widget_no_household)
            is WidgetPayload.Ready ->
                if (payload.open == 0) {
                    AllDone(medium)
                } else {
                    OpenList(payload, medium, rowBudget(size.height.value, medium))
                }
        }
    }
}

private fun rowBudget(height: Float, medium: Boolean): Int {
    val free = height - 2 * PADDING.value - HEADER.value - FOOTER.value
    return (free / ROW.value).toInt().coerceIn(1, if (medium) 5 else 3)
}

@Composable
private fun Prompt(@StringRes message: Int) {
    val context = LocalContext.current
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = context.getString(R.string.widget_label),
            style = TextStyle(color = color(R.color.hl_brand), fontSize = 16.sp, fontWeight = FontWeight.Bold),
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            text = context.getString(message),
            style = TextStyle(color = color(R.color.hl_text), fontSize = 14.sp),
            maxLines = 4,
        )
    }
}

@Composable
private fun AllDone(medium: Boolean) {
    val context = LocalContext.current
    val label = context.getString(R.string.widget_all_done)
    val hex = @Composable {
        Image(provider = ImageProvider(R.drawable.widget_done_hex), contentDescription = null)
    }
    val text = @Composable { modifier: GlanceModifier ->
        Text(
            text = label,
            modifier = modifier,
            style = TextStyle(color = color(R.color.hl_text), fontSize = 15.sp, fontWeight = FontWeight.Bold),
            maxLines = 2,
        )
    }
    if (medium) {
        Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            hex()
            text(GlanceModifier.padding(start = 10.dp).defaultWeight())
            AddButton()
        }
    } else {
        Column(
            modifier = GlanceModifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            hex()
            text(GlanceModifier.padding(top = 8.dp))
        }
    }
}

@Composable
private fun OpenList(payload: WidgetPayload.Ready, medium: Boolean, budget: Int) {
    val context = LocalContext.current
    val rows = widgetRows(payload.items, budget)
    val more = payload.open - rows.size
    Column(modifier = GlanceModifier.fillMaxSize()) {
        if (medium) {
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OpenCount(payload.open, GlanceModifier.defaultWeight())
                AddButton()
            }
        } else {
            OpenCount(payload.open)
        }
        Spacer(GlanceModifier.height(6.dp))
        rows.forEach { ItemRow(it, pills = medium) }
        if (more > 0) {
            Text(
                text = context.getString(R.string.widget_more, more),
                modifier = GlanceModifier.padding(top = 2.dp),
                style = TextStyle(color = color(R.color.hl_text_muted), fontSize = 12.sp),
                maxLines = 1,
            )
        }
    }
}

/** The one big number: open items in brand, "offen" quiet beside it. */
@Composable
private fun OpenCount(open: Int, modifier: GlanceModifier = GlanceModifier) {
    val context = LocalContext.current
    val spoken = context.getString(R.string.widget_open_count, open)
    Row(
        modifier = modifier.semantics { contentDescription = spoken },
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            text = open.toString(),
            style = TextStyle(color = color(R.color.hl_brand), fontSize = 30.sp, fontWeight = FontWeight.Bold),
            maxLines = 1,
        )
        Text(
            text = context.getString(R.string.widget_open_label),
            // The bottom padding sits the label on the number's baseline rather than its descent.
            modifier = GlanceModifier.padding(start = 5.dp, bottom = 5.dp),
            style = TextStyle(color = color(R.color.hl_text_muted), fontSize = 14.sp, fontWeight = FontWeight.Medium),
            maxLines = 1,
        )
    }
}

@Composable
private fun AddButton() {
    val context = LocalContext.current
    // Wrapped, not a fixed 32 dp: the nine-patch is drawn for 32 dp and only its tip rows
    // stretch, so a large font grows the button instead of clipping the label.
    Box(
        modifier = GlanceModifier
            .background(ImageProvider(R.drawable.widget_add_button))
            .padding(horizontal = 14.dp, vertical = 6.dp)
            .clickable(actionStartActivity<MainActivity>(context, ADD_URI)),
        contentAlignment = Alignment.Center,
    ) {
        val style = TextStyle(color = color(R.color.hl_on_honey), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = "+", style = style.copy(fontSize = 17.sp), maxLines = 1)
            Text(
                text = context.getString(R.string.widget_add),
                modifier = GlanceModifier.padding(start = 4.dp),
                style = style,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun ItemRow(row: WidgetRow, pills: Boolean) {
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(modifier = GlanceModifier.defaultWeight(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = row.item.name,
                style = TextStyle(color = color(R.color.hl_text), fontSize = 14.sp, fontWeight = FontWeight.Medium),
                maxLines = 1,
            )
            row.item.quantity?.let {
                Text(
                    text = it,
                    modifier = GlanceModifier.padding(start = 6.dp),
                    style = TextStyle(color = color(R.color.hl_text_muted), fontSize = 13.sp),
                    maxLines = 1,
                )
            }
        }
        val store = row.item.store
        if (pills && row.showsStore && store != null) {
            Spacer(GlanceModifier.width(6.dp))
            StorePill(store)
        }
    }
}

@Composable
private fun StorePill(name: String) {
    Box(
        modifier = GlanceModifier
            .background(ImageProvider(R.drawable.widget_pill))
            .padding(horizontal = 10.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = name,
            style = TextStyle(color = color(R.color.hl_text), fontSize = 11.sp, fontWeight = FontWeight.Bold),
            maxLines = 1,
        )
    }
}
