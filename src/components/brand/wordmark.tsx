import { cn } from "cn";

/**
 * Hamkke 브랜드 심볼 — H(서 있는 사람, ember)와 K(그 등에 기댄 사람, dusk)를
 * 인체 실루엣으로 재해석한 라인아트(DESIGN.md §1, §8). 온보딩·빈 상태
 * 화면에서 항상 이 하나의 심볼만 재사용한다 — 화면마다 새로 그리지 않는다.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-24", className)}
    >
      <path d="M42 104 L42 40" stroke="var(--color-ember)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="42" cy="28" r="10" stroke="var(--color-ember)" strokeWidth="4" />
      <path
        d="M78 104 C78 86 66 70 54 52"
        stroke="var(--dusk-ink)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="49" cy="43" r="10" stroke="var(--dusk-ink)" strokeWidth="4" />
    </svg>
  );
}
