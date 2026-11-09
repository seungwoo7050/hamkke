import "server-only";
import pRetry, { AbortError } from "p-retry";
import { MESSAGES } from "@/i18n/messages";

const WEATHER_KO = MESSAGES.ko.weather as Record<string, string>;

const RAIN_OR_SNOW_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
]);

export function describeWeatherCode(code: number) {
  return WEATHER_KO[`c${code}`] ?? WEATHER_KO.unknown;
}

export function isRainOrSnow(code: number) {
  return RAIN_OR_SNOW_CODES.has(code);
}

export type Weather = { temperatureC: number; weatherCode: number; description: string };

// API 키 없이 쓸 수 있는 Open-Meteo(비상업 용도 무료) - 2인 전용 앱이라
// 트래픽이 극히 적어 별도 캐싱 없이 그대로 호출한다.
// 날씨는 장면의 주변부 정보다. 공통 레이아웃이 이 조회를 기다리므로, 응답하지
// 않는 날씨 서버가 앱 전체를 붙잡지 않게 짧게 끊고(제한이 없으면 Node fetch는
// 300초를 기다렸다), 일시적 429·5xx는 p-retry로 한 번만 재시도한다.
const WEATHER_TIMEOUT_MS = 2000;

export async function fetchWeather(
  lat: number,
  lng: number,
  { timeoutMs = WEATHER_TIMEOUT_MS, retries = 1 }: { timeoutMs?: number; retries?: number } = {},
): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "auto");

  const data = await pRetry(
    async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        const err = new Error(`날씨 조회 실패: ${res.status}`);
        if (res.status !== 429 && res.status < 500) throw new AbortError(err);
        throw err;
      }
      return (await res.json()) as {
        current: { temperature_2m: number; weather_code: number };
      };
    },
    {
      retries,
      minTimeout: 100,
      shouldRetry: ({ error }) => error.name !== "TimeoutError" && error.name !== "AbortError",
    },
  );

  return {
    temperatureC: data.current.temperature_2m,
    weatherCode: data.current.weather_code,
    description: describeWeatherCode(data.current.weather_code),
  };
}
