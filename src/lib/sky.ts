// "우리" 장면의 하늘 토큰 선택(DESIGN.md §3.1 하늘 토큰). 현지 시각 기준
// day 07–17시, dusk 05–07·17–20시, night 20–05시.
export type SkyPhase = "day" | "dusk" | "night";

export function localHour(timeZone: string, date: Date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date),
  );
}

export function skyPhase(timeZone: string, date: Date = new Date()): SkyPhase {
  const hour = localHour(timeZone, date);
  if (hour >= 7 && hour < 17) return "day";
  if ((hour >= 5 && hour < 7) || (hour >= 17 && hour < 20)) return "dusk";
  return "night";
}
