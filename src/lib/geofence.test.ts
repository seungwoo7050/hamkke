import { describe, expect, it } from "vitest";
import { nextGeofenceState } from "./geofence";

const fence = { radiusM: 200 };

function replay(distancesM: number[], accuracyM: number) {
  let isInside = false;
  let arrivals = 0;
  for (const distanceM of distancesM) {
    const next = nextGeofenceState({ ...fence, isInside }, distanceM, accuracyM);
    if (next && !isInside) arrivals++;
    isInside = next;
  }
  return { isInside, arrivals };
}

describe("nextGeofenceState", () => {
  it("경계 근처에서 정확도보다 작게 흔들리면 도착을 한 번만 판정한다", () => {
    // 300m 밖 → 150m 안 → 경계 ±10m 흔들림 → 250m
    expect(replay([300, 150, 210, 190, 205, 195, 250], 30)).toEqual({
      isInside: true,
      arrivals: 1,
    });
  });

  it("반경 + 여유 + 정확도를 확실히 벗어나야 밖으로 판정하고, 다시 들어오면 또 도착이다", () => {
    expect(replay([300, 150, 300, 150], 30)).toEqual({ isInside: true, arrivals: 2 });
  });

  it("정확도가 반경보다 나쁜 좌표로는 상태를 바꾸지 않는다", () => {
    expect(nextGeofenceState({ ...fence, isInside: false }, 50, 500)).toBe(false);
    expect(nextGeofenceState({ ...fence, isInside: true }, 900, 500)).toBe(true);
  });

  it("정확도가 없으면 0으로 본다", () => {
    expect(nextGeofenceState({ ...fence, isInside: false }, 199)).toBe(true);
    expect(nextGeofenceState({ ...fence, isInside: true }, 251)).toBe(false);
  });
});
