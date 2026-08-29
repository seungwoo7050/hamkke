// 두 IANA 타임존 간 시차는 DST 때문에 고정 상수가 아니라 현재 시점 기준으로
// 매번 계산해야 정확하다.
export function offsetMinutes(timeZone: string, date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUTC - date.getTime()) / 60000;
}

/** a 기준으로 b가 몇 시간 앞서 있는지(양수: b가 더 이름). */
export function timezoneDiffHours(a: string, b: string, date: Date = new Date()) {
  return (offsetMinutes(b, date) - offsetMinutes(a, date)) / 60;
}

const SLEEP_START_HOUR = 23;
const SLEEP_END_HOUR = 7;

/** 단순 시간대 기반 추정 — 실제 수면 패턴을 학습하지 않는다(PRD.md §3.3). */
export function isLikelySleeping(timeZone: string, date: Date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date),
  );
  return hour >= SLEEP_START_HOUR || hour < SLEEP_END_HOUR;
}
