// 브랜드 심볼 기하(DESIGN.md §1.1) — 120 격자, 둥근 끝 획. 정적 심볼
// (wordmark.tsx)과 터치 수신 모티프(touch-motif.tsx)가 같은 값을 쓴다.
export const MARK = {
  viewBox: "1.5 5.5 120 120",
  stroke: 18,
  gap: 3.5,
  h: { body: "M40 102 V54", head: { cx: 40, cy: 32, r: 12 } },
  k: { body: "M86 102 L57 61", head: { cx: 60, cy: 41, r: 11.5 }, foot: { x: 86, y: 102 } },
} as const;
