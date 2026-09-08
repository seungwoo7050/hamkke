import { describe, expect, it } from "vitest";
import { distanceKm, formatDistanceKm, isMeetingSoon } from "./geo";

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
