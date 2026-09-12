"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { SPRING } from "@/lib/motion";
import { MARK } from "./mark-geometry";

/**
 * 터치 수신 모티프(DESIGN.md §8, §1.1) — 심볼의 K(기댄 사람)가 떨어져 서
 * 있다가 H의 등에 "기대는" 순간을 spring 프리셋 하나로 보여준다. 움직이는 건
 * K 한 획뿐(발끝을 축으로 회전)이고, H를 비우는 마스크 속 K도 같은 회전을
 * 따라가 틈이 K와 함께 움직인다. 동작 줄이기 설정이면 기댄 최종 자세만.
 */
export function TouchMotif({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const maskId = useId();
  const { h, k, stroke, gap } = MARK;

  const lean = {
    style: {
      originX: `${k.foot.x}px`,
      originY: `${k.foot.y}px`,
      transformBox: "view-box" as const,
    },
    initial: reduce ? false : { rotate: 22 },
    animate: { rotate: 0 },
    transition: { ...SPRING, delay: 0.15 },
  };

  return (
    <svg
      viewBox={MARK.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-24", className)}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect x="0" y="0" width="130" height="130" fill="white" />
        <motion.g {...lean}>
          <path d={k.body} stroke="black" strokeWidth={stroke + gap * 2} strokeLinecap="round" />
          <circle cx={k.head.cx} cy={k.head.cy} r={k.head.r + gap} fill="black" />
        </motion.g>
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d={h.body} stroke="var(--color-ember)" strokeWidth={stroke} strokeLinecap="round" />
        <circle cx={h.head.cx} cy={h.head.cy} r={h.head.r} fill="var(--color-ember)" />
      </g>
      <motion.g {...lean}>
        <path d={k.body} stroke="var(--dusk-ink)" strokeWidth={stroke} strokeLinecap="round" />
        <circle cx={k.head.cx} cy={k.head.cy} r={k.head.r} fill="var(--dusk-ink)" />
      </motion.g>
    </svg>
  );
}
