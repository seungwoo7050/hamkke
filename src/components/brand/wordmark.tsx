import { useId } from "react";
import { cn } from "cn";
import { MARK } from "./mark-geometry";

/**
 * Hamkke 브랜드 심볼(DESIGN.md §1.1) - 곧게 선 H(ember)의 등에 K(dusk)가 어깨와
 * 머리를 기댄 구도. 두 획이 겹치는 곳은 K 둘레만큼 H를 마스크로 비워 배경색
 * 틈을 만든다 - 배경색을 따로 알 필요가 없어 어떤 면 위에서도 같게 보인다.
 * 온보딩·빈 상태·장면에서 항상 이 하나만 재사용한다(§8).
 */
export function Wordmark({ className, tight }: { className?: string; tight?: boolean }) {
  const maskId = useId();
  const { h, k, stroke, gap } = MARK;

  return (
    <svg
      viewBox={tight ? MARK.tightViewBox : MARK.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-24", className)}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect x="0" y="0" width="130" height="130" fill="white" />
        <path d={k.body} stroke="black" strokeWidth={stroke + gap * 2} strokeLinecap="round" />
        <circle cx={k.head.cx} cy={k.head.cy} r={k.head.r + gap} fill="black" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d={h.body} stroke="var(--color-ember)" strokeWidth={stroke} strokeLinecap="round" />
        <circle cx={h.head.cx} cy={h.head.cy} r={h.head.r} fill="var(--color-ember)" />
      </g>
      <path d={k.body} stroke="var(--dusk-ink)" strokeWidth={stroke} strokeLinecap="round" />
      <circle cx={k.head.cx} cy={k.head.cy} r={k.head.r} fill="var(--dusk-ink)" />
    </svg>
  );
}
