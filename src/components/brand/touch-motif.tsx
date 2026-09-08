"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { SPRING } from "@/lib/motion";

/**
 * 터치 수신 모티프(DESIGN.md §8) — 워드마크의 K(기댄 사람)가 떨어져 서
 * 있다가 H의 등에 "기대는" 순간을 spring 프리셋 하나로 보여준다. 선·색은
 * wordmark.tsx와 같고, 움직이는 건 K 한 획뿐이다(발끝 78,104을 축으로 회전).
 * 동작 줄이기 설정이면 기댄 최종 자세만 보여준다.
 */
export function TouchMotif({ className }: { className?: string }) {
  const reduce = useReducedMotion();

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
      <motion.g
        style={{ originX: "78px", originY: "104px", transformBox: "view-box" }}
        initial={reduce ? false : { rotate: 24 }}
        animate={{ rotate: 0 }}
        transition={{ ...SPRING, delay: 0.15 }}
      >
        <path
          d="M78 104 C78 86 66 70 54 52"
          stroke="var(--dusk-ink)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="49" cy="43" r="10" stroke="var(--dusk-ink)" strokeWidth="4" />
      </motion.g>
    </svg>
  );
}
