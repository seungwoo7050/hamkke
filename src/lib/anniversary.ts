// 다가오는 기념일 계산은 정확한 시각 push 스케줄러 없이(docs/COMMIT_PLAN.md
// Phase 4 각주) 조회 시점 기준으로만 한다 — 매번 "오늘 기준으로 이 기념일이
// 며칠 남았는지"를 다시 계산해서 보여준다.

/** recurring이면 올해(이미 지났으면 내년) 발생일로 보정, 아니면 원래 날짜 그대로. */
export function nextOccurrence(date: Date, recurring: boolean, from: Date = new Date()): Date {
  if (!recurring) return date;

  const next = new Date(date);
  next.setFullYear(from.getFullYear());

  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (next < fromMidnight) {
    next.setFullYear(from.getFullYear() + 1);
  }
  return next;
}

/** target까지 남은 날짜 수(자정 기준, 음수면 이미 지난 날짜). */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
