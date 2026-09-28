import { describe, expect, it } from "vitest";
import { getAirport, searchAirports } from "./airports";

describe("공항 데이터", () => {
  it("IATA로 좌표·시간대·한국어 이름을 찾는다", () => {
    expect(getAirport("icn")).toMatchObject({
      iata: "ICN",
      city: "인천",
      timeZone: "Asia/Seoul",
    });
    expect(getAirport("JFK")?.timeZone).toBe("America/New_York");
    expect(getAirport("XXX")).toBeNull();
  });

  it("한국어 이름이 없는 공항은 원문 도시명", () => {
    expect(getAirport("ANC")?.city).toBe("Anchorage");
  });

  it("검색: 정확한 코드가 맨 앞, 한국어 도시명으로도 찾는다", () => {
    expect(searchAirports("jfk")[0].iata).toBe("JFK");
    expect(searchAirports("뉴욕").map((a) => a.iata)).toEqual(
      expect.arrayContaining(["JFK", "EWR", "LGA"]),
    );
    expect(searchAirports("london")[0].city).toBe("런던");
    expect(searchAirports("  ")).toEqual([]);
  });

  it("한국어 이름은 한국어 화면에서만 - 다른 언어는 영어 원문", () => {
    expect(getAirport("ICN", "en")?.name).toBe("Incheon International Airport");
    expect(getAirport("JFK", "en")?.city).toBe("New York");
    expect(searchAirports("뉴욕", 8, "en").map((a) => a.iata)).toContain("JFK");
    expect(searchAirports("뉴욕", 8, "en").map((a) => a.city)).not.toContain("뉴욕");
  });
});
