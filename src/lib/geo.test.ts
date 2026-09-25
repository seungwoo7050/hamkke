import { describe, expect, it } from "vitest";
import { distanceKm, formatDistanceKm, isMeetingSoon, nearSideOf } from "./geo";

describe("distanceKm", () => {
  it("같은 좌표는 0", () => {
    expect(distanceKm({ lat: 37.5665, lng: 126.978 }, { lat: 37.5665, lng: 126.978 })).toBeCloseTo(
      0,
    );
  });

  it("서울-부산 직선거리는 약 325km", () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const busan = { lat: 35.1796, lng: 129.0756 };
    expect(distanceKm(seoul, busan)).toBeCloseTo(325, 0);
  });
});

describe("formatDistanceKm", () => {
  it("1km 미만은 m 단위로 표시", () => {
    expect(formatDistanceKm(0.42)).toBe("420m");
  });

  it("1km 이상 100km 미만은 소수점 한 자리까지 km로 표시", () => {
    expect(formatDistanceKm(32.54)).toBe("32.5km");
  });

  it("100km 이상은 정수 km로 표시", () => {
    expect(formatDistanceKm(325.4)).toBe("325km");
    expect(formatDistanceKm(11052.6)).toBe("11,053km");
  });
});

describe("isMeetingSoon", () => {
  it("기본 임계값(3km) 이내면 true", () => {
    expect(isMeetingSoon(2.9)).toBe(true);
    expect(isMeetingSoon(3)).toBe(true);
  });

  it("임계값보다 멀면 false", () => {
    expect(isMeetingSoon(3.1)).toBe(false);
  });

  it("임계값을 직접 지정할 수 있다", () => {
    expect(isMeetingSoon(4, 5)).toBe(true);
  });
});

describe("nearSideOf", () => {
  // 서울(127°E)과 LA(118°W)는 태평양 쪽으로 가까운데, 경도 그대로 범위를 잡으면
  // 지구 반대편(유럽 쪽)으로 도는 범위가 된다. 상대 경도를 내 쪽으로 이어 붙인다.
  it("날짜변경선을 사이에 두면 경도를 360만큼 옮겨 가까운 쪽에 둔다", () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const la = { lat: 34.0522, lng: -118.2437 };
    expect(nearSideOf(seoul, la)).toEqual({ lat: 34.0522, lng: -118.2437 + 360 });
    expect(nearSideOf(la, seoul)).toEqual({ lat: 37.5665, lng: 126.978 - 360 });
  });

  it("가까운 두 점은 그대로 둔다", () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const busan = { lat: 35.1796, lng: 129.0756 };
    expect(nearSideOf(seoul, busan)).toEqual(busan);
  });
});
