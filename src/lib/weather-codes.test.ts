import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ko from "../../messages/ko.json";
import { describeWeatherCode, isRainOrSnow } from "./weather";
import { WeatherIcon, isRainOrSnowCode, weatherMessageKey } from "./weather-codes";

// 아이콘은 이름만 비교한다 — lucide-react는 테스트의 react-server 조건에서 불러올 수 없다.
vi.mock("lucide-react", () =>
  Object.fromEntries(
    ["Cloud", "CloudFog", "CloudLightning", "CloudRain", "CloudSun", "Snowflake", "Sun"].map(
      (n) => [n, n],
    ),
  ),
);

// Open-Meteo가 current.weather_code로 줄 수 있는 WMO 코드 전부(문서의 표).
// 하나라도 빠지면 그 날씨인 날 장면에 "알 수 없음"이 뜨고 비/눈 판정도 빠진다.
const ALL_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99,
];
const PRECIPITATION = ALL_CODES.filter((c) => c >= 51);
const SNOW = [71, 73, 75, 77, 85, 86];

describe("WMO 날씨 코드", () => {
  it.each(ALL_CODES)("%i: 두 언어의 문구와 서버 설명이 있다", (code) => {
    const key = weatherMessageKey(code);
    expect(key).not.toBe("unknown");
    expect(ko.weather).toHaveProperty(key);
    expect(en.weather).toHaveProperty(key);
    expect(describeWeatherCode(code)).not.toBe("알 수 없음");
  });

  it("강수 코드는 화면·서버 모두 비/눈으로 판정한다", () => {
    for (const code of ALL_CODES) {
      const expected = PRECIPITATION.includes(code);
      expect([code, isRainOrSnowCode(code)]).toEqual([code, expected]);
      expect([code, isRainOrSnow(code)]).toEqual([code, expected]);
    }
  });

  it("눈 계열(눈 소나기 85·86 포함)은 눈 아이콘이다", () => {
    for (const code of SNOW)
      expect([code, WeatherIcon({ code }).type]).toEqual([code, "Snowflake"]);
  });
});
