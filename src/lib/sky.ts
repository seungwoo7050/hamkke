// "우리" 장면의 하늘 토큰 선택(DESIGN.md §3.1 하늘 토큰). 현지 시각 기준
// day 07–17시, dusk 05–07·17–20시, night 20–05시.
export type SkyPhase = "day" | "dusk" | "night";

export function localHour(timeZone: string, date: Date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date),
  );
}

export function skyPhase(timeZone: string, date: Date = new Date()): SkyPhase {
  return phaseForHour(localHour(timeZone, date));
}

/**
 * 비행 중인 쪽의 하늘(PRD §3.3.1) — 시간대가 없는 하늘 위라, 추정 위치의
 * 경도로 계산한 태양시(UTC + 경도/15)를 쓴다.
 */
export function skyPhaseAtLongitude(lng: number, date: Date = new Date()): SkyPhase {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solar = (((utcHours + lng / 15) % 24) + 24) % 24;
  return phaseForHour(Math.floor(solar));
}

function phaseForHour(hour: number): SkyPhase {
  if (hour >= 7 && hour < 17) return "day";
  if ((hour >= 5 && hour < 7) || (hour >= 17 && hour < 20)) return "dusk";
  return "night";
}
