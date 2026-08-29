import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";

type Weather = inferRouterOutputs<AppRouter>["weather"]["forSpace"]["me"];

const RAIN_OR_SNOW = new Set([51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99]);

function summary(label: string, weather: Weather) {
  if (!weather) return `${label} 위치공유 꺼짐`;
  return `${label} ${weather.description} ${Math.round(weather.temperatureC)}°C`;
}

// 날씨는 위치처럼 실시간으로 급변하지 않아 Realtime 구독 없이 SSR 초기값만
// 보여준다(홈 새로고침/재방문 시 최신화).
export function WeatherWidget({ me, partner }: { me: Weather; partner: Weather }) {
  if (!me && !partner) return null;

  const bothRainy =
    !!me && !!partner && RAIN_OR_SNOW.has(me.weatherCode) && RAIN_OR_SNOW.has(partner.weatherCode);

  return (
    <div className="text-muted-foreground border-border flex items-center justify-between border-b px-6 py-2 text-xs">
      <span>
        {summary("나", me)} · {summary("상대방", partner)}
      </span>
      {bothRainy && <span>지금 거기도 비 와요?</span>}
    </div>
  );
}
