"use client";

import { Moon } from "lucide-react";
import { cn } from "cn";
import { Wordmark } from "@/components/brand/wordmark";
import { formatDistanceKm } from "@/lib/geo";
import { isLikelySleeping } from "@/lib/timezone";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";
import { isRainOrSnowCode, WeatherIcon } from "@/lib/weather-codes";
import { useDistance } from "./location-context";
import { LocationSheet } from "./location-sheet";
import { displayName, useSpace, type HomeSummary } from "./space-context";

type Weather = HomeSummary["me"]["weather"];

function formatTime(timeZone: string, now: Date) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone, hour: "numeric", minute: "2-digit" }).format(
    now,
  );
}

function Side({
  label,
  timeZone,
  weather,
  now,
  className,
}: {
  label: string;
  timeZone: string | null;
  weather: Weather;
  now: Date;
  className?: string;
}) {
  const hydrated = useHydrated();
  const sleeping = timeZone ? isLikelySleeping(timeZone, now) : false;

  return (
    <div className={cn("flex flex-col gap-1 px-4 pt-5 pb-16", className)}>
      <span className="text-sm font-medium opacity-75">{label}</span>
      <span className="mt-1 min-h-9 text-3xl font-bold tracking-tight">
        {timeZone && hydrated ? formatTime(timeZone, now) : null}
      </span>
      {weather && (
        <span className="flex items-center gap-1 text-sm opacity-85">
          <WeatherIcon code={weather.weatherCode} className="size-4" /> {weather.description}{" "}
          {Math.round(weather.temperatureC)}°
        </span>
      )}
      {hydrated && sleeping && (
        <span className="mt-2 flex items-center gap-1 text-sm font-medium">
          <Moon className="size-4" /> 자고 있을 시간
        </span>
      )}
    </div>
  );
}

// "우리" 탭의 주인공 장면(DESIGN.md §2 Calm Technology, §4). 흘끗 보면 되는
// 정보 — 서로의 현지 시각·날씨·수면 상태·거리 — 를 숫자 나열이 아니라 두
// 사람이 나란히 선 한 장면으로 압축한다. 가운데 기댄 모티프(§1)가 두 영역을
// 잇고, 누르면 위치 시트가 열린다.
// "곧 만나요" — 거리가 임계값 안으로 들어오면(src/lib/geo.ts) 둘로 나뉜 장면
// 대신 두 사람이 한 장면에 모인다. 상황 카드보다 우선하는 최상위 상태라
// 카드가 아니라 장면 자체를 바꾼다(PRD §3.3 만남 모드, §3.7 우선순위).
function MeetingSoonScene({ km, approaching }: { km: number; approaching: boolean }) {
  return (
    <section aria-label="곧 만나요" className="px-4">
      <LocationSheet>
        <button
          type="button"
          className="bg-sky-dusk flex w-full flex-col items-start gap-1 rounded-xl px-5 pt-5 pb-6 text-left"
        >
          <Wordmark className="size-20" />
          <span className="text-dusk mt-2 text-sm font-medium">
            {approaching ? "점점 가까워지고 있어요" : "가까이 있어요"}
          </span>
          <span className="text-foreground text-3xl font-bold tracking-tight">곧 만나요</span>
          <span className="text-foreground text-5xl font-bold tracking-tight">
            {formatDistanceKm(km)}
          </span>
        </button>
      </LocationSheet>
    </section>
  );
}

export function UsScene() {
  const { summary } = useSpace();
  const { km, approaching, meetingSoon } = useDistance();
  const hydrated = useHydrated();
  const now = useNow(30_000);
  const partnerName = displayName(summary.partner, "상대");
  // 내 시간대는 서버 저장값보다 지금 이 브라우저가 아는 값이 더 정확하다.
  const myTz = hydrated
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : (summary.me.timezone ?? null);

  const bothRainy =
    !!summary.me.weather &&
    !!summary.partner?.weather &&
    isRainOrSnowCode(summary.me.weather.weatherCode) &&
    isRainOrSnowCode(summary.partner.weather.weatherCode);

  if (meetingSoon && km !== null) return <MeetingSoonScene km={km} approaching={approaching} />;

  return (
    <section aria-label="지금 우리" className="px-4">
      <div className="relative grid grid-cols-2 overflow-hidden rounded-xl">
        <Side
          label="나"
          timeZone={myTz}
          weather={summary.me.weather}
          now={now}
          className="bg-muted"
        />
        <Side
          label={partnerName}
          timeZone={summary.partner?.timezone ?? null}
          weather={summary.partner?.weather ?? null}
          now={now}
          className="bg-muted"
        />
        <LocationSheet>
          <button
            type="button"
            aria-label="위치 보기"
            className="bg-background shadow-soft text-foreground absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full py-1.5 pr-4 pl-2 text-sm font-semibold"
          >
            <Wordmark className="size-9" />
            {km !== null ? formatDistanceKm(km) : "위치 보기"}
          </button>
        </LocationSheet>
      </div>
      {bothRainy && (
        <p className="text-muted-foreground mt-2 text-sm">둘 다 비 오는 날이에요. 우산 챙겼어요?</p>
      )}
    </section>
  );
}
