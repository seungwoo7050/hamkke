import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react";

// WMO 날씨 코드(open-meteo) → 아이콘. src/lib/weather.ts는 server-only라
// 클라이언트 장면에서 쓸 매핑을 따로 둔다.
export function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code <= 1) return <Sun className={className} />;
  if (code === 2) return <CloudSun className={className} />;
  if (code === 3) return <Cloud className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  if (code >= 71 && code <= 77) return <Snowflake className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  return <CloudRain className={className} />;
}

const RAIN_OR_SNOW = new Set([51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99]);

export function isRainOrSnowCode(code: number) {
  return RAIN_OR_SNOW.has(code);
}
