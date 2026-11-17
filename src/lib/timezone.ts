import { tzOffset } from "@date-fns/tz";

const validTimeZones = new Map<string, boolean>();

/**
 * Intl이 아는 IANA 시간대 이름인지. 모르는 이름을 Intl.DateTimeFormat에 넘기면
 * RangeError가 나고, 그 값이 상대의 화면 렌더링까지 멈춘다(상대 시간대를 그린다).
 */
export function isValidTimeZone(timeZone: string) {
  let valid = validTimeZones.get(timeZone);
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      valid = true;
    } catch {
      valid = false;
    }
    validTimeZones.set(timeZone, valid);
  }
  return valid;
}

/** 저장된 시간대를 화면으로 내보낼 때 - 검증 전에 저장된 잘못된 값은 "모름"으로. */
export function validTimeZoneOrNull(timeZone: string | null | undefined) {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
}

// 두 IANA 타임존 간 시차는 DST 때문에 고정 상수가 아니라 현재 시점 기준으로
// 매번 계산해야 정확하다.
export function offsetMinutes(timeZone: string, date: Date = new Date()) {
  return tzOffset(timeZone, date);
}

/** a 기준으로 b가 몇 시간 앞서 있는지(양수: b가 더 이름). */
export function timezoneDiffHours(a: string, b: string, date: Date = new Date()) {
  return (offsetMinutes(b, date) - offsetMinutes(a, date)) / 60;
}

const SLEEP_START_HOUR = 23;
const SLEEP_END_HOUR = 7;

/** 단순 시간대 기반 추정 - 실제 수면 패턴을 학습하지 않는다(PRD.md §3.3). */
export function isLikelySleeping(timeZone: string, date: Date = new Date()) {
  const hour = new Date(date.getTime() + tzOffset(timeZone, date) * 60_000).getUTCHours();
  return hour >= SLEEP_START_HOUR || hour < SLEEP_END_HOUR;
}
