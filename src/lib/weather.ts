import "server-only";

// WMO Weather interpretation codes - open-meteo.com/en/docs 표에서 발췌.
const WEATHER_CODE_KO: Record<number, string> = {
  0: "맑음",
  1: "대체로 맑음",
  2: "구름 조금",
  3: "흐림",
  45: "안개",
  48: "짙은 안개",
  51: "이슬비",
  53: "이슬비",
  55: "이슬비",
  56: "어는 이슬비",
  57: "어는 이슬비",
  61: "비",
  63: "비",
  65: "강한 비",
  66: "어는 비",
  67: "강한 어는 비",
  71: "눈",
  73: "눈",
  75: "강한 눈",
  77: "싸락눈",
  80: "소나기",
  81: "소나기",
  82: "강한 소나기",
  85: "눈 소나기",
  86: "강한 눈 소나기",
  95: "뇌우",
  96: "뇌우(우박)",
  99: "뇌우(강한 우박)",
};

const RAIN_OR_SNOW_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
]);

export function describeWeatherCode(code: number) {
  return WEATHER_CODE_KO[code] ?? "알 수 없음";
}

export function isRainOrSnow(code: number) {
  return RAIN_OR_SNOW_CODES.has(code);
}

export type Weather = { temperatureC: number; weatherCode: number; description: string };

// API 키 없이 쓸 수 있는 Open-Meteo(비상업 용도 무료) - 2인 전용 앱이라
// 트래픽이 극히 적어 별도 캐싱 없이 그대로 호출한다.
// 날씨는 장면의 주변부 정보다. 공통 레이아웃이 이 조회를 기다리므로, 응답하지
// 않는 날씨 서버가 앱 전체를 붙잡지 않게 짧게 끊는다(제한이 없으면 Node fetch는
// 300초를 기다렸다). 끊기면 거절되어 호출하는 쪽의 .catch(() => null)이 받는다.
const WEATHER_TIMEOUT_MS = 2000;

export async function fetchWeather(
  lat: number,
  lng: number,
  { timeoutMs = WEATHER_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`날씨 조회 실패: ${res.status}`);
  }
  const data = (await res.json()) as {
    current: { temperature_2m: number; weather_code: number };
  };

  return {
    temperatureC: data.current.temperature_2m,
    weatherCode: data.current.weather_code,
    description: describeWeatherCode(data.current.weather_code),
  };
}
