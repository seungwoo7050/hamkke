import { describe, expect, it } from "vitest";
import { parseBoardingPass } from "./bcbp";

// IATA BCBP 필수 항목 60자 + 가변 영역. 287번째 날 = 10월 14일(평년).
const KE081 =
  "M1KIM/JIWOO           EABC123 ICNJFKKE 0081 287Y032A0001 100" +
  ">5180  6287BKE              2A1802315426670 KE                        N";

describe("탑승권 바코드(BCBP)", () => {
  it("편명·공항·날짜만 뽑는다(이름·예약번호·좌석은 버림)", () => {
    const leg = parseBoardingPass(KE081, new Date("2026-09-27T00:00:00Z"));
    expect(leg).toEqual({
      flightNumber: "KE081",
      fromIata: "ICN",
      toIata: "JFK",
      departureDate: "2026-10-14",
    });
    expect(JSON.stringify(leg)).not.toMatch(/KIM|ABC123|032A/);
  });

  it("연도가 없어 12월에 받은 1월 탑승권은 내년으로", () => {
    const jan = KE081.replace("ICNJFKKE 0081 287", "ICNJFKKE 0081 010");
    expect(parseBoardingPass(jan, new Date("2026-12-20T00:00:00Z"))?.departureDate).toBe(
      "2027-01-10",
    );
  });

  it("편 번호 접미 문자와 네 자리 번호", () => {
    const s = KE081.replace("KE 0081 ", "7C 1101D");
    expect(parseBoardingPass(s, new Date("2026-09-27T00:00:00Z"))?.flightNumber).toBe("7C1101D");
  });

  it("BCBP가 아니면 null", () => {
    expect(parseBoardingPass("https://example.com")).toBeNull();
    expect(parseBoardingPass("M1짧음")).toBeNull();
  });
});
