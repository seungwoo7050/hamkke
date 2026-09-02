// "체크인" 전용 버튼 없이, 메시지를 보낸 날을 자동으로 활동일로 센다
// (PRD.md §3.4 "연속 접속/대화 일수"). 하루 경계는 서버(UTC)가 아니라
// 클라이언트의 로컬 타임존 기준이어야 정확해서, 서버는 원시 날짜만 주고
// 이 함수가 클라이언트에서 그룹핑·연속 계산을 한다.
export function computeStreak(dates: Date[], from: Date = new Date()) {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const activeDays = new Set(dates.map(dayKey));

  const cursor = new Date(from);
  const activeToday = activeDays.has(dayKey(from));
  // 오늘 아직 활동이 없어도 스트릭이 바로 끊긴 것으로 보지 않는다(하루가
  // 끝나기 전까지는 "아직 기회가 남은" 상태) — 어제부터 거슬러 센다.
  if (!activeToday) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streak, activeToday };
}
