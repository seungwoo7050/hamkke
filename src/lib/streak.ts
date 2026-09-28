// "체크인" 전용 버튼 없이, 메시지를 보낸 날을 자동으로 활동일로 센다
// (PRD.md §3.4 "연속 접속/대화 일수"). 하루 경계는 서버(UTC)가 아니라 보는
// 사람의 시간대 기준이어야 해서, 서버가 그 시간대로 메시지를 날짜("YYYY-MM-DD")로
// 묶어 넘기고 이 함수는 그 날짜들로 연속 일수만 센다.
import type { YMD } from "@/lib/datetime";

export function dayKey({ y, m, d }: YMD) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function previousDay({ y, m, d }: YMD): YMD {
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return { y: prev.getUTCFullYear(), m: prev.getUTCMonth() + 1, d: prev.getUTCDate() };
}

export function computeStreak(activeDays: Iterable<string>, today: YMD) {
  const days = new Set(activeDays);
  const activeToday = days.has(dayKey(today));
  // 오늘 아직 활동이 없어도 스트릭이 바로 끊긴 것으로 보지 않는다(하루가
  // 끝나기 전까지는 "아직 기회가 남은" 상태) - 어제부터 거슬러 센다.
  let cursor = activeToday ? today : previousDay(today);

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = previousDay(cursor);
  }

  return { streak, activeToday };
}
