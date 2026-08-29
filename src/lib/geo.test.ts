import { describe, expect, it } from "vitest";
import { distanceKm, formatDistanceKm } from "./geo";

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

  it("1km 이상은 km 단위로 표시", () => {
    expect(formatDistanceKm(325.4)).toBe("325.4km");
  });
});
