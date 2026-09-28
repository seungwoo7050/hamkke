package com.hamkke.app.widget

import android.content.Context
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.layout.wrapContentHeight
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.hamkke.app.MainActivity
import com.hamkke.app.R

// DESIGN.md 토큰 - 앱 아이콘과 같은 밤하늘(dusk) 면 위에 크림 글자(§1.1 앱
// 아이콘). ember는 대비가 낮아(dusk 위 약 2.4:1) 글자가 아닌 하트·심볼에만.
private val Dusk = Color(0xFF4B4468)
private val Cream = Color(0xFFFFF4E6)
private val CreamMuted = Color(0xB3FFF4E6)
private val Ember = Color(0xFFF2653A)

/**
 * Android 홈 화면 위젯(Phase 6, PRD 연결 기능) - 앱을 열지 않고 흘끗 보는 세 가지:
 * 상대의 지금 시각(=시차), 거리, 마지막으로 받은 터치(Calm Technology 주변부).
 * 상대 시각은 TextClock이 기기 시계로 매분 그려서 새로고침 사이에도 멈추지 않는다.
 */
class HamkkeWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val state = WidgetRepository.load(context)
        provideContent { WidgetContent(state) }
    }
}

class HamkkeWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = HamkkeWidget()
}

@Composable
private fun WidgetContent(state: WidgetState) {
    val strings = WidgetStrings(state.lang)
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(Dusk)
            .cornerRadius(24.dp)
            .padding(16.dp)
            .clickable(actionStartActivity<MainActivity>()),
    ) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Image(
                provider = ImageProvider(R.drawable.widget_mark),
                contentDescription = null,
                modifier = GlanceModifier.size(20.dp),
            )
            Spacer(GlanceModifier.width(6.dp))
            Text(strings.appName, style = TextStyle(color = ColorProvider(Cream), fontSize = 13.sp, fontWeight = FontWeight.Bold))
            Spacer(GlanceModifier.defaultWeight())
            if (state is WidgetState.Ready && state.distanceKm != null) {
                Text(
                    WidgetFormat.distance(state.distanceKm, state.lang),
                    style = TextStyle(color = ColorProvider(Cream), fontSize = 13.sp, fontWeight = FontWeight.Bold),
                )
            }
        }
        Spacer(GlanceModifier.defaultWeight())
        when (state) {
            is WidgetState.Ready -> ReadyBody(state, strings)
            is WidgetState.SignedOut -> Message(strings.signedOut)
            is WidgetState.Unpaired -> Message(strings.unpaired)
            is WidgetState.Offline -> Message(strings.offline)
        }
    }
}

@Composable
private fun ReadyBody(state: WidgetState.Ready, strings: WidgetStrings) {
    val name = state.partnerName ?: strings.partnerFallback
    val now = System.currentTimeMillis()
    val myTz = state.myTimezone ?: java.util.TimeZone.getDefault().id

    if (state.partnerTimezone == null) {
        Message(strings.waitingForPartner(name))
    } else {
        Text(strings.partnerNow(name), style = TextStyle(color = ColorProvider(CreamMuted), fontSize = 12.sp))
        AndroidRemoteViews(
            remoteViews = RemoteViews(LocalContext.current.packageName, R.layout.widget_partner_clock).apply {
                setString(R.id.partner_clock, "setTimeZone", state.partnerTimezone)
                // 어순만 언어에 맞춘다 - "오후/PM" 표시 자체는 RemoteViews로 로케일을
                // 정할 수 없어 기기 언어를 따른다.
                val pattern = if (state.lang == "ko") "a h:mm" else "h:mm a"
                setCharSequence(R.id.partner_clock, "setFormat12Hour", pattern)
                setCharSequence(R.id.partner_clock, "setFormat24Hour", pattern)
            },
            modifier = GlanceModifier.wrapContentHeight(),
        )
        Spacer(GlanceModifier.height(2.dp))
    }
    Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (state.partnerTimezone != null) {
            Text(
                WidgetFormat.timeDifference(myTz, state.partnerTimezone, now, state.lang),
                style = TextStyle(color = ColorProvider(CreamMuted), fontSize = 12.sp),
                maxLines = 1,
            )
        }
        Spacer(GlanceModifier.defaultWeight())
        Image(
            provider = ImageProvider(R.drawable.widget_heart),
            contentDescription = null,
            colorFilter = ColorFilter.tint(ColorProvider(Ember)),
            modifier = GlanceModifier.size(12.dp),
        )
        Spacer(GlanceModifier.width(4.dp))
        Text(
            state.lastTouchMillis?.let { WidgetFormat.lastTouch(it, myTz, now, state.lang) }
                ?: strings.noTouchYet,
            style = TextStyle(color = ColorProvider(Cream), fontSize = 12.sp),
            maxLines = 1,
        )
    }
}

@Composable
private fun Message(text: String) {
    Text(text, style = TextStyle(color = ColorProvider(Cream), fontSize = 14.sp, fontWeight = FontWeight.Medium))
}
