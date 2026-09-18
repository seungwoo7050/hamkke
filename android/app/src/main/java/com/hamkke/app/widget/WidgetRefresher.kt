package com.hamkke.app.widget

import android.content.Context
import android.webkit.CookieManager
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * 앱을 떠날 때(MainActivity.onPause) 위젯을 새로 그린다 — 방금 앱에서 본 상태
 * (로그인·페어링·새 터치)를 위젯에 바로 반영. 쿠키를 먼저 디스크에 내려써 위젯
 * 요청이 방금 로그인한 세션을 쓰게 한다. 위젯이 하나도 없으면 아무 일도 안 한다.
 */
object WidgetRefresher {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @JvmStatic
    fun refresh(context: Context) {
        val app = context.applicationContext
        CookieManager.getInstance().flush()
        scope.launch { runCatching { HamkkeWidget().updateAll(app) } }
    }
}
