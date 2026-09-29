import { useId } from "react";
import { cn } from "cn";

/**
 * 상황 카드의 작은 그림(DESIGN.md §8) - 심볼과 같은 언어로 그린 두 사람.
 * 동그란 머리 + 둥근 몸통, 주황(ember)은 곧게 서고 인디고(dusk-ink)는 발끝을
 * 축으로 기댄다. 겹치는 곳은 심볼처럼 B 둘레만큼 A를 마스크로 비워 어떤 카드
 * 배경에서도 같은 틈이 보인다. 감정적 순간의 카드에만 쓰고 설정·안내 카드는
 * lucide 아이콘을 유지한다.
 */
export type Spot = "together" | "letter" | "apart" | "soon";

const GROUND = 44;
const GAP = 1.6;

function personA(x: number, y: number) {
  return (
    <>
      <circle cx={x} cy={y} r={6} />
      <path d={`M${x - 8} ${GROUND} V${y + 16} a8 8 0 0 1 16 0 V${GROUND}Z`} />
    </>
  );
}

// B는 발끝(오른쪽 아래)을 축으로 rot도 기운다 - 땅 아래로 내려간 몸통은 viewBox가 자른다.
function personB(x: number, y: number, rot: number, grow = 0) {
  return (
    <g transform={`rotate(${rot} ${x + 7.5} ${GROUND})`}>
      <circle cx={x} cy={y} r={5.5 + grow} />
      <path
        d={`M${x - 7.5 - grow} ${GROUND + 2} V${y + 15.5} a${7.5 + grow} ${7.5 + grow} 0 0 1 ${15 + grow * 2} 0 V${GROUND + 2}Z`}
      />
    </g>
  );
}

function Heart({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 2.2C0-.6-3.6-1.4-4.6 1-5.6 3.4-2.4 5.6 0 7.4 2.4 5.6 5.6 3.4 4.6 1 3.6-1.4 0-.6 0 2.2Z"
      fill="var(--color-ember)"
    />
  );
}

// 두 사람이 붙어 있는 구도 - A(16)의 등에 B(32)가 머리를 기댄다.
function Leaning({ maskId }: { maskId: string }) {
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect width="48" height="48" fill="white" />
        <g fill="black">{personB(32, 19, -14, GAP)}</g>
      </mask>
      <g mask={`url(#${maskId})`} fill="var(--color-ember)">
        {personA(16, 15)}
      </g>
      <g fill="var(--dusk-ink)">{personB(32, 19, -14)}</g>
    </>
  );
}

export function SpotArt({ spot, className }: { spot: Spot; className?: string }) {
  const maskId = useId();
  const clipId = useId();
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-10", className)}>
      <clipPath id={clipId}>
        <rect width="48" height={GROUND} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {spot === "together" || spot === "letter" ? (
          <Leaning maskId={maskId} />
        ) : spot === "apart" ? (
          <>
            <g fill="var(--color-ember)">{personA(10, 22)}</g>
            <g fill="var(--dusk-ink)">{personB(38, 23, 0)}</g>
          </>
        ) : (
          <>
            <g fill="var(--color-ember)">{personA(12, 20)}</g>
            <g fill="var(--dusk-ink)">{personB(36, 21, -6)}</g>
          </>
        )}
      </g>
      {spot === "together" && <Heart x={22} y={2} s={0.85} />}
      {spot === "letter" && (
        <g transform="translate(22 5)">
          <rect x="-5.5" y="-4" width="11" height="8" rx="1.6" fill="var(--color-ember)" />
          <path
            d="M-4.2-2.6 0 .6 4.2-2.6"
            stroke="var(--color-muted)"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {spot === "apart" && (
        <g fill="none" stroke="var(--dusk-ink)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M9 10Q22 2 34 9" strokeDasharray="1.6 2.6" />
          <path
            transform="translate(36 10) rotate(15)"
            d="M0-3.2 7 0 0 3.2 1.6 0Z"
            fill="var(--dusk-ink)"
            stroke="none"
          />
        </g>
      )}
      {spot === "soon" && <Heart x={24} y={22} s={0.75} />}
    </svg>
  );
}
