import { describe, expect, it } from "vitest";
import { fromZonedLocal, toZonedLocal } from "./datetime";
import {
  bestTimes,
  flightPhase,
  flightProgress,
  formatRemaining,
  greatCirclePath,
  greatCirclePoint,
  normalizeFlightNumber,
  resolveArrival,
} from "./flight";
import { skyPhaseAtLongitude } from "./sky";

const ICN = { lat: 37.4691, lng: 126.451 };
const JFK = { lat: 40.6398, lng: -73.7789 };

// KE081: 인천 10/14 10:30(KST) → 뉴욕 10/14 11:20(EDT), 약 13시간 50분
const dep = fromZonedLocal("2026-10-14T10:30", "Asia/Seoul");
const flight = {
  scheduledDepartureAt: dep,
  scheduledArrivalAt: fromZonedLocal("2026-10-14T11:20", "America/New_York"),
};

describe("현지 시각 ↔ UTC", () => {
  it("공항 현지 벽시계를 실제 순간으로, 그리고 되돌린다", () => {
    expect(dep.toISOString()).toBe("2026-10-14T01:30:00.000Z");
    expect(toZonedLocal(dep, "Asia/Seoul")).toBe("2026-10-14T10:30");
    // 뉴욕 서머타임 해제 직후(11/1 이후 EST, -5)
    expect(fromZonedLocal("2026-11-02T08:00", "America/New_York").toISOString()).toBe(
      "2026-11-02T13:00:00.000Z",
    );
  });
});

describe("도착 날짜 추론", () => {
  it("날짜변경선을 넘어 같은 날짜로 도착해도 맞는다", () => {
    const arr = resolveArrival(dep, "2026-10-14", "11:20", "America/New_York");
    expect(arr?.toISOString()).toBe("2026-10-14T15:20:00.000Z");
  });

  it("다음 날 도착(뉴욕 → 인천)", () => {
    const d = fromZonedLocal("2026-08-30T00:50", "America/New_York");
    const arr = resolveArrival(d, "2026-08-30", "04:30", "Asia/Seoul");
    expect(arr?.toISOString()).toBe("2026-08-30T19:30:00.000Z"); // 8/31 04:30 KST
  });

  it("20시간을 넘는 해석밖에 없으면 null", () => {
    const d = fromZonedLocal("2026-10-14T10:30", "Asia/Seoul");
    expect(resolveArrival(d, "2026-10-14", "10:29", "Asia/Seoul")).toBeNull();
  });
});

describe("단계·진행", () => {
  it("출발 24시간 전부터 곧 출발, 비행 중, 도착 후 12시간까지 도착", () => {
    const at = (h: number) => new Date(dep.getTime() + h * 3_600_000);
    expect(flightPhase(flight, at(-30))).toBe("upcoming");
    expect(flightPhase(flight, at(-2))).toBe("departingSoon");
    expect(flightPhase(flight, at(5))).toBe("inFlight");
    expect(flightPhase(flight, at(15))).toBe("arrived");
    expect(flightPhase(flight, at(30))).toBe("past");
    expect(flightProgress(flight, at(0))).toBe(0);
    expect(flightProgress(flight, at(100))).toBe(1);
  });

  it("실제 시각이 생기면 그걸 먼저 쓴다(유료 API 단계 대비)", () => {
    const late = new Date(flight.scheduledArrivalAt.getTime() + 3_600_000);
    const t = bestTimes({ ...flight, actualArrivalAt: late });
    expect(t.arrivalAt).toEqual(late);
    expect(t.estimated).toBe(false);
    expect(bestTimes(flight).estimated).toBe(true);
  });

  it("남은 시간 표기", () => {
    expect(formatRemaining(7 * 3_600_000 + 10 * 60_000)).toBe("7시간 10분");
    expect(formatRemaining(40 * 60_000)).toBe("40분");
    expect(formatRemaining(3 * 3_600_000)).toBe("3시간");
    expect(formatRemaining(20_000)).toBe("곧");
  });
});

describe("대권 경로", () => {
  it("양 끝은 공항, 중간은 북태평양 위(인천 → 뉴욕은 북극 쪽으로 휜다)", () => {
    expect(greatCirclePoint(ICN, JFK, 0).lat).toBeCloseTo(ICN.lat, 3);
    expect(greatCirclePoint(ICN, JFK, 1).lng).toBeCloseTo(JFK.lng, 3);
    expect(greatCirclePoint(ICN, JFK, 0.5).lat).toBeGreaterThan(60);
  });

  it("날짜변경선을 넘어도 경도가 이어진다", () => {
    const path = greatCirclePath(ICN, JFK, 32);
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i][1] - path[i - 1][1])).toBeLessThan(30);
    }
  });
});

describe("기타", () => {
  it("편명 정규화", () => {
    expect(normalizeFlightNumber(" ke 081 ")).toBe("KE081");
    expect(normalizeFlightNumber("7C1101")).toBe("7C1101");
    expect(normalizeFlightNumber("KOREAN")).toBeNull();
  });

  it("하늘 위의 하늘은 경도 태양시", () => {
    // UTC 03:00, 경도 135° → 태양시 12시 → day
    expect(skyPhaseAtLongitude(135, new Date("2026-10-14T03:00:00Z"))).toBe("day");
    // UTC 03:00, 경도 -75° → 태양시 22시 → night
    expect(skyPhaseAtLongitude(-75, new Date("2026-10-14T03:00:00Z"))).toBe("night");
  });
});

describe("장면·카드가 다룰 항공편", () => {
  const at = (h: number) => new Date(dep.getTime() + h * 3_600_000);
  const later = {
    scheduledDepartureAt: at(48),
    scheduledArrivalAt: at(60),
  };
  it("비행 중 > 막 도착 > 곧 출발", async () => {
    const { pickFlight } = await import("./flight");
    expect(pickFlight([flight, later], at(5))?.phase).toBe("inFlight");
    expect(pickFlight([flight, later], at(15))?.phase).toBe("arrived");
    expect(pickFlight([flight, later], at(40))?.flight).toBe(later);
    expect(pickFlight([flight], at(40))).toBeNull();
  });
});
