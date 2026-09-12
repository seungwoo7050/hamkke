package com.hamkke.app.widget

import org.junit.Assert.assertEquals
import org.junit.Test

// 웹 src/lib/datetime.test.ts와 같은 기준 순간:
// 2026-09-27T15:12Z = 서울 9/28 00:12, 뉴욕 9/27 11:12
class WidgetFormatTest {
    private val at = 1790521920000L // 2026-09-27T15:12:00Z

    @Test
    fun distance() {
        assertEquals("11,053km", WidgetFormat.distance(11053))
        assertEquals("42km", WidgetFormat.distance(42))
    }

    @Test
    fun timeDifference() {
        assertEquals("나보다 13시간 느려요", WidgetFormat.timeDifference("Asia/Seoul", "America/New_York", at))
        assertEquals("나보다 13시간 빨라요", WidgetFormat.timeDifference("America/New_York", "Asia/Seoul", at))
        assertEquals("나보다 3시간 30분 느려요", WidgetFormat.timeDifference("Asia/Seoul", "Asia/Kolkata", at))
        assertEquals("같은 시간대예요", WidgetFormat.timeDifference("Asia/Seoul", "Asia/Tokyo", at))
    }

    @Test
    fun time() {
        assertEquals("오전 12:12", WidgetFormat.time(at, "Asia/Seoul"))
        assertEquals("오전 11:12", WidgetFormat.time(at, "America/New_York"))
        assertEquals("오후 12:00", WidgetFormat.time(1790478000000L, "Asia/Seoul")) // 03:00Z
    }

    @Test
    fun lastTouchIsAbsoluteSoItNeverGoesStale() {
        val now = 1790571600000L // 2026-09-28T05:00Z = 서울 9/28 14:00, 뉴욕 9/28 01:00
        assertEquals("오늘 오전 12:12", WidgetFormat.lastTouch(at, "Asia/Seoul", now))
        assertEquals("어제 오전 11:12", WidgetFormat.lastTouch(at, "America/New_York", now))
        assertEquals("9월 20일", WidgetFormat.lastTouch(at - 7 * 86_400_000L - 3_600_000L, "Asia/Seoul", now))
    }
}
