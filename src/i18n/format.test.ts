import { describe, expect, it } from "vitest";
import { formatters } from "./format";

const ko = formatters("ko");
const en = formatters("en");
// 2026-09-27T15:12Z = 서울 9/28(월) 00:12, 뉴욕 9/27(일) 11:12
const at = new Date("2026-09-27T15:12:00Z");

describe("언어별 표기", () => {
  it("시각", () => {
    expect(ko.time(at, "Asia/Seoul")).toBe("오전 12:12");
    expect(en.time(at, "Asia/Seoul")).toBe("12:12 AM");
    expect(en.time(at, "America/New_York")).toBe("11:12 AM");
  });

  it("날짜·날짜+시각", () => {
    expect(ko.ymd({ y: 2026, m: 10, d: 14 }, { weekday: true })).toBe("10월 14일 (수)");
    expect(en.ymd({ y: 2026, m: 10, d: 14 }, { weekday: true })).toBe("Wed, Oct 14");
    expect(en.ymd({ y: 2025, m: 12, d: 31 }, { year: true })).toBe("Dec 31, 2025");
    expect(en.dateTime(new Date("2026-09-29T12:00:00Z"), "Asia/Seoul")).toBe(
      "Tue, Sep 29, 9:00 PM",
    );
  });

  it("채팅 구분선", () => {
    const now = new Date("2026-09-28T03:00:00Z");
    expect(en.dayLabel(new Date("2026-09-28T01:00:00Z"), "Asia/Seoul", now)).toBe("Today");
    expect(en.dayLabel(new Date("2026-09-27T01:00:00Z"), "Asia/Seoul", now)).toBe("Yesterday");
    expect(en.dayLabel(new Date("2026-09-20T01:00:00Z"), "Asia/Seoul", now)).toBe("Sun, Sep 20");
  });

  it("상대 시각·남은 시간·거리", () => {
    const now = new Date("2026-09-27T18:12:00Z");
    expect(ko.relativeAdverb(at, now)).toBe("3시간 전에");
    expect(en.relative(at, now)).toBe("3 hours ago");
    expect(en.relative(now, now)).toBe("just now");
    expect(en.remaining(7 * 3_600_000 + 10 * 60_000)).toBe("7h 10m");
    expect(ko.remaining(40 * 60_000)).toBe("40분");
    expect(en.remaining(30_000)).toBeNull();
    expect(ko.distance(11053)).toBe("11,053km");
    expect(en.distance(11053)).toBe("11,053 km");
  });

  it("D-day - 영어엔 D-day 관습이 없어 풀어 쓴다", () => {
    expect(ko.dday(18)).toBe("D-18");
    expect(en.dday(18)).toBe("in 18 days");
    expect(en.dday(1)).toBe("in 1 day");
    expect(en.dday(0)).toBe("Today");
    expect(en.ddayBig(18)).toBe("18 days");
    expect(ko.ddayBig(-3)).toBe("D+3");
  });

  it("이름 뒤 조사는 한국어만", () => {
    expect(ko.particles("지우")).toMatchObject({
      name: "지우",
      nameSubj: "지우가",
      nameTopic: "지우는",
    });
    expect(ko.particles("서준").nameSubj).toBe("서준이");
    expect(en.particles("Jiwoo")).toMatchObject({ name: "Jiwoo", nameSubj: "Jiwoo" });
    expect(ko.particles("KE081", "flight").flightSubj).toBe("KE081이");
  });
});

describe("bytes", () => {
  it("1GB 미만은 MB, 이상은 GB로 언어에 맞게(100 이상은 정수)", () => {
    expect(formatters("ko").bytes(1_572_864)).toBe("1.5MB");
    expect(formatters("en").bytes(1_572_864)).toBe("1.5 MB");
    expect(formatters("ko").bytes(327_680_000)).toBe("313MB");
    expect(formatters("ko").bytes(1024 ** 3)).toBe("1GB");
    expect(formatters("en").bytes(20 * 1024 ** 3)).toBe("20 GB");
  });
});
