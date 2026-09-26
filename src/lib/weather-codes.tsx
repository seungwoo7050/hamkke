import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react";

// WMO 날씨 코드(open-meteo) → 아이콘. src/lib/weather.ts는 server-only라
// 클라이언트 장면에서 쓸 매핑을 따로 둔다.
export function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code <= 1) return <Sun className={className} />;
  if (code === 2) return <CloudSun className={className} />;
  if (code === 3) return <Cloud className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return <Snowflake className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  return <CloudRain className={className} />;
}

const DESCRIBED_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99,
] as const;
type DescribedCode = (typeof DESCRIBED_CODES)[number];
const DESCRIBED = new Set<number>(DESCRIBED_CODES);

/**
 * 날씨 문구 키(messages weather.*). 서버가 주는 description은 한국어라 화면에선
 * 코드로 현재 언어의 문구를 찾는다.
 */
export function weatherMessageKey(code: number): `c${DescribedCode}` | "unknown" {
  return DESCRIBED.has(code) ? (`c${code}` as `c${DescribedCode}`) : "unknown";
}

const RAIN_OR_SNOW = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
]);

export function isRainOrSnowCode(code: number) {
  return RAIN_OR_SNOW.has(code);
}
