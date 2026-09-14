// 비행(PRD §3.3.1)의 순수 계산 — 서버·클라이언트 공용. 실제 이륙·착륙을 모르는
// 무료 범위라 모든 판단은 "가장 믿을 만한 시각"(실제 시각이 있으면 그것, 없으면
// 예정 시각) 하나에서 나온다. 유료 항공편 API가 실제 시각을 채우면 이 파일을
// 쓰는 화면은 그대로 정확해진다.
import { fromZonedLocal } from "./datetime";

type LatLng = { lat: number; lng: number };

export type FlightTimes = {
  scheduledDepartureAt: Date | string;
  scheduledArrivalAt: Date | string;
  actualDepartureAt?: Date | string | null;
  actualArrivalAt?: Date | string | null;
};

export function bestTimes(f: FlightTimes) {
  return {
    departureAt: new Date(f.actualDepartureAt ?? f.scheduledDepartureAt),
    arrivalAt: new Date(f.actualArrivalAt ?? f.scheduledArrivalAt),
    /** 실제 착륙 시각을 모른다 — 화면은 "예정 기준"이라고 밝힌다 */
    estimated: !f.actualArrivalAt,
  };
}

/** 출발 전 카드를 띄우는 시간(출발 24시간 전부터). */
export const DEPARTING_SOON_MS = 24 * 60 * 60_000;
/** 착륙 카드를 유지하는 시간(도착 후 12시간). */
export const ARRIVED_RECENTLY_MS = 12 * 60 * 60_000;

export type FlightPhase = "upcoming" | "departingSoon" | "inFlight" | "arrived" | "past";

export function flightPhase(f: FlightTimes, now: Date): FlightPhase {
  const { departureAt, arrivalAt } = bestTimes(f);
  const t = now.getTime();
  if (t < departureAt.getTime() - DEPARTING_SOON_MS) return "upcoming";
  if (t < departureAt.getTime()) return "departingSoon";
  if (t < arrivalAt.getTime()) return "inFlight";
  if (t < arrivalAt.getTime() + ARRIVED_RECENTLY_MS) return "arrived";
  return "past";
}

/** 0(출발)~1(도착) */
export function flightProgress(f: FlightTimes, now: Date) {
  const { departureAt, arrivalAt } = bestTimes(f);
  const total = arrivalAt.getTime() - departureAt.getTime();
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - departureAt.getTime()) / total));
}

/** "7시간 10분", "40분", "곧" */
export function formatRemaining(ms: number) {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "곧";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * 대권(지구 위 최단) 경로에서 t(0~1) 지점 — 추정 위치. 실제 항로는 바람·
 * 항로 규칙으로 다르지만, "지금 어디쯤"을 보여주기엔 충분하다.
 */
export function greatCirclePoint(a: LatLng, b: LatLng, t: number): LatLng {
  const φ1 = rad(a.lat);
  const λ1 = rad(a.lng);
  const φ2 = rad(b.lat);
  const λ2 = rad(b.lng);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    );
  if (d === 0) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lng: deg(Math.atan2(y, x)) };
}

/**
 * 지도에 그릴 대권 경로. 날짜변경선(±180°)을 넘을 때 선이 지구 반대편으로
 * 튀지 않게 경도를 이어 붙인다(Leaflet은 360° 넘는 경도도 그대로 그린다).
 */
export function greatCirclePath(a: LatLng, b: LatLng, segments = 64): [number, number][] {
  const points: [number, number][] = [];
  let prevLng: number | null = null;
  for (let i = 0; i <= segments; i++) {
    const p = greatCirclePoint(a, b, i / segments);
    let lng = p.lng;
    if (prevLng !== null) {
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
    }
    prevLng = lng;
    points.push([p.lat, lng]);
  }
  return points;
}

/**
 * 도착은 현지 "시각"만 받는다(탑승권에도 날짜는 출발일뿐). 출발 순간 이후
 * 20시간 안에서 그 현지 시각이 되는 첫 순간을 도착으로 본다 — 날짜변경선을
 * 넘어 같은 날짜나 전날로 도착하는 경우(인천 10:30 → 뉴욕 같은 날 11:20)도 맞는다.
 */
export const MAX_FLIGHT_MS = 20 * 60 * 60_000;

export function resolveArrival(
  departureAt: Date,
  departureLocalDate: string,
  arrivalTime: string,
  arrivalTimeZone: string,
): Date | null {
  const base = new Date(`${departureLocalDate}T00:00:00Z`);
  for (const offset of [-1, 0, 1, 2]) {
    const day = new Date(base.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    const candidate = fromZonedLocal(`${day}T${arrivalTime}`, arrivalTimeZone);
    const duration = candidate.getTime() - departureAt.getTime();
    if (duration > 0 && duration <= MAX_FLIGHT_MS) return candidate;
  }
  return null;
}

/** "KE 081" → "KE081". 항공사 코드(2자, 숫자 섞일 수 있음) + 편 번호 1~4자리 + 선택 접미 문자. */
export function normalizeFlightNumber(input: string) {
  const v = input.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$/.test(v) ? v : null;
}
