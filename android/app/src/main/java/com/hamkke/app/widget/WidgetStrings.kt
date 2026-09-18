package com.hamkke.app.widget

import java.util.Locale

/**
 * 위젯 문구(PRD §3.8). 웹은 messages 폴더의 문구 파일이지만 위젯은 네이티브라 여기 둔다 —
 * 언어는 서버가 알려준 사용자 언어(/api/widget의 locale), 로그인 전엔 기기 언어.
 * 새 언어를 더하면 웹 문구 파일과 함께 여기에도 분기를 더한다.
 */
class WidgetStrings(val lang: String) {
    private val ko = lang == "ko"

    val appName get() = if (ko) "함께" else "Hamkke"
    val signedOut get() = if (ko) "앱을 열어 로그인하면\n여기에 우리가 보여요" else "Sign in to the app\nto see the two of you here"
    val unpaired get() = if (ko) "상대와 연결되면\n여기에 우리가 보여요" else "Connect with your person\nto see the two of you here"
    val offline get() = if (ko) "인터넷에 연결되면 채워져요" else "This fills in once you're online"
    val partnerFallback get() = if (ko) "상대" else "Your person"
    val noTouchYet get() = if (ko) "아직 받은 터치가 없어요" else "No touches yet"

    fun waitingForPartner(name: String) =
        if (ko) "${name}의 시간은 상대가 앱을 열면 채워져요" else "$name's time shows up once they open the app"

    fun partnerNow(name: String) = if (ko) "${name}의 지금" else "$name's time"

    companion object {
        /** 서버 기본값과 같은 규칙 — 한국어·영어가 아니면 한국어. */
        fun deviceLang(): String = if (Locale.getDefault().language == "en") "en" else "ko"

        fun normalize(lang: String?): String = if (lang == "ko" || lang == "en") lang else deviceLang()
    }
}
