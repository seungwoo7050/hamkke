package com.hamkke.app.widget

import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs

/**
 * 위젯 표기 - 웹(src/i18n/format.ts)과 같은 한국어·영어 표기를 기기 로케일과
 * 상관없이 직접 조립한다(lang = "ko" | "en"). minSdk 24라 java.time 대신 TimeZone/Calendar를 쓴다.
 * 새로고침(30분) 사이에 낡지 않도록 "58분 전" 같은 상대 표기는 쓰지 않는다.
 */
object WidgetFormat {
    /** "11,053km" · "11,053 km" */
    fun distance(km: Int, lang: String = "ko"): String =
        NumberFormat.getIntegerInstance(Locale.US).format(km) + if (lang == "ko") "km" else " km"

    /** 상대 시각이 나보다 얼마나 빠르고 느린지 - "나보다 13시간 느려요", "나보다 9시간 30분 빨라요". */
    fun timeDifference(myTz: String, partnerTz: String, nowMillis: Long, lang: String = "ko"): String {
        val diffMinutes = (TimeZone.getTimeZone(partnerTz).getOffset(nowMillis) -
            TimeZone.getTimeZone(myTz).getOffset(nowMillis)) / 60_000
        val h = abs(diffMinutes) / 60
        val m = abs(diffMinutes) % 60
        if (lang != "ko") {
            if (diffMinutes == 0) return "Same time zone"
            val amount = when {
                h == 0 -> "${m}m"
                m == 0 -> "${h}h"
                else -> "${h}h ${m}m"
            }
            return "$amount ${if (diffMinutes > 0) "ahead of you" else "behind you"}"
        }
        if (diffMinutes == 0) return "같은 시간대예요"
        val amount = when {
            h == 0 -> "${m}분"
            m == 0 -> "${h}시간"
            else -> "${h}시간 ${m}분"
        }
        return "나보다 $amount ${if (diffMinutes > 0) "빨라요" else "느려요"}"
    }

    /** "오후 2:25" */
    fun time(millis: Long, tz: String, lang: String = "ko"): String {
        val c = calendar(millis, tz)
        val hour = c.get(Calendar.HOUR_OF_DAY)
        val h12 = if (hour % 12 == 0) 12 else hour % 12
        if (lang != "ko") {
            return "$h12:${"%02d".format(c.get(Calendar.MINUTE))} ${if (hour < 12) "AM" else "PM"}"
        }
        return "${if (hour < 12) "오전" else "오후"} $h12:${"%02d".format(c.get(Calendar.MINUTE))}"
    }

    /** 마지막으로 받은 터치 - "오늘 오후 2:25" · "어제 오후 11:03" · "9월 25일". */
    fun lastTouch(touchMillis: Long, tz: String, nowMillis: Long, lang: String = "ko"): String {
        val days = dayNumber(nowMillis, tz) - dayNumber(touchMillis, tz)
        if (lang != "ko") {
            return when (days) {
                0L -> "Today ${time(touchMillis, tz, lang)}"
                1L -> "Yesterday ${time(touchMillis, tz, lang)}"
                else -> {
                    val c = calendar(touchMillis, tz)
                    "${MONTHS_EN[c.get(Calendar.MONTH)]} ${c.get(Calendar.DAY_OF_MONTH)}"
                }
            }
        }
        return when (days) {
            0L -> "오늘 ${time(touchMillis, tz)}"
            1L -> "어제 ${time(touchMillis, tz)}"
            else -> {
                val c = calendar(touchMillis, tz)
                "${c.get(Calendar.MONTH) + 1}월 ${c.get(Calendar.DAY_OF_MONTH)}일"
            }
        }
    }

    private val MONTHS_EN =
        listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

    private fun calendar(millis: Long, tz: String) =
        Calendar.getInstance(TimeZone.getTimeZone(tz)).apply { timeInMillis = millis }

    // 그 시간대의 달력 날짜를 일 단위 정수로 - 날짜 경계 비교용.
    private fun dayNumber(millis: Long, tz: String): Long {
        val c = calendar(millis, tz)
        val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            clear()
            set(c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH))
        }
        return utc.timeInMillis / 86_400_000L
    }
}
