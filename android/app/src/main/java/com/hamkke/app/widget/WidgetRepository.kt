package com.hamkke.app.widget

import android.content.Context
import android.webkit.CookieManager
import com.getcapacitor.CapConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

/** 위젯이 그릴 상태. */
sealed interface WidgetState {
    /** 문구 언어("ko" | "en") */
    val lang: String

    data class Ready(
        override val lang: String,
        val myTimezone: String?,
        val partnerName: String?,
        val partnerTimezone: String?,
        val distanceKm: Int?,
        val lastTouchMillis: Long?,
    ) : WidgetState

    data class SignedOut(override val lang: String) : WidgetState
    data class Unpaired(override val lang: String) : WidgetState
    data class Offline(override val lang: String) : WidgetState
}

/**
 * /api/widget(서버 home.widget)을 웹뷰와 같은 세션 쿠키로 부른다 — 위젯은 앱과
 * 같은 프로세스라 CookieManager의 쿠키를 그대로 쓸 수 있어 별도 토큰이 없다.
 * 서버 주소는 capacitor.config의 server.url(웹뷰가 여는 곳)을 그대로 따른다.
 * 네트워크가 안 되면 마지막으로 받은 값을 보여준다(시각은 어차피 기기 시계).
 */
object WidgetRepository {
    private const val PREFS = "hamkke_widget"
    private const val KEY_LAST = "last_ok_json"

    suspend fun load(context: Context): WidgetState {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val fresh = runCatching { fetch(context) }.getOrNull()
        return when {
            fresh == null -> prefs.getString(KEY_LAST, null)?.let { parse(JSONObject(it)) }
                ?: WidgetState.Offline(WidgetStrings.deviceLang())
            fresh.optString("status") == "ok" -> {
                prefs.edit().putString(KEY_LAST, fresh.toString()).apply()
                parse(fresh)
            }
            else -> {
                // 로그아웃·연결 해제는 캐시로 덮지 않는다 — 남의 화면이 남으면 안 됨.
                prefs.edit().remove(KEY_LAST).apply()
                val lang = WidgetStrings.normalize(fresh.optStringOrNull("locale"))
                if (fresh.optString("status") == "unpaired") WidgetState.Unpaired(lang)
                else WidgetState.SignedOut(lang)
            }
        }
    }

    private suspend fun fetch(context: Context): JSONObject {
        val base = CapConfig.loadDefault(context).serverUrl
            ?: error("server.url이 없어 위젯이 서버를 찾을 수 없어요")
        // CookieManager는 메인 스레드에서 다룬다.
        val cookie = withContext(Dispatchers.Main) { CookieManager.getInstance().getCookie(base) }
        return withContext(Dispatchers.IO) {
            val conn = URL(base.trimEnd('/') + "/api/widget").openConnection() as HttpURLConnection
            try {
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                if (cookie != null) conn.setRequestProperty("Cookie", cookie)
                // 로그인 전엔 기기 언어로 문구를 정하도록(서버 언어 결정 2순위).
                conn.setRequestProperty("Accept-Language", Locale.getDefault().toLanguageTag())
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (code == 401 || code == 403) JSONObject(body.ifEmpty { "{}" })
                    .apply { if (!has("status")) put("status", "signed-out") }
                else if (code in 200..299) JSONObject(body)
                else error("위젯 API 응답 $code")
            } finally {
                conn.disconnect()
            }
        }
    }

    private fun parse(json: JSONObject) = WidgetState.Ready(
        lang = WidgetStrings.normalize(json.optStringOrNull("locale")),
        myTimezone = json.optStringOrNull("myTimezone"),
        partnerName = json.optStringOrNull("partnerName"),
        partnerTimezone = json.optStringOrNull("partnerTimezone"),
        distanceKm = if (json.isNull("distanceKm")) null else json.optInt("distanceKm"),
        lastTouchMillis = json.optStringOrNull("lastTouchReceivedAt")?.let { parseIso(it) },
    )

    private fun JSONObject.optStringOrNull(key: String) =
        if (!has(key) || isNull(key)) null else getString(key)

    // "2026-09-27T05:25:00.000Z" — minSdk 24라 java.time 대신 SimpleDateFormat.
    private fun parseIso(iso: String): Long? = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", java.util.Locale.US).parse(iso)?.time
    }.getOrNull()
}
