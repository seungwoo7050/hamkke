"use client";

import { Moon } from "lucide-react";
import { cn } from "cn";
import { Wordmark } from "@/components/brand/wordmark";
import { formatDistanceKm } from "@/lib/geo";
import { josa } from "@/lib/josa";
import { formatTime } from "@/lib/datetime";
import { skyPhase, type SkyPhase } from "@/lib/sky";
import { isLikelySleeping } from "@/lib/timezone";
import { useNow } from "@/lib/use-now";
import { isRainOrSnowCode, WeatherIcon } from "@/lib/weather-codes";
import { useDistance } from "./location-context";
import { LocationSheet } from "./location-sheet";
import { usePartnerPresent } from "./presence-context";
import { displayName, useMyTimeZone, useSpace, type HomeSummary } from "./space-context";

type Weather = HomeSummary["me"]["weather"];

// 하늘 토큰은 장면 배경 전용(DESIGN.md §3.1). night 위 글자는 zinc-50.
const SKY_CLASS: Record<SkyPhase, string> = {
  day: "bg-sky-day text-foreground",
  dusk: "bg-sky-dusk text-foreground",
  night: "bg-sky-night text-zinc-50",
};

function Side({
  label,
  timeZone,
  weather,
  now,
  present = false,
  placeholder,
  className,
}: {
  label: string;
  timeZone: string | null;
  weather: Weather;
  now: Date;
  /** 상대가 지금 앱을 보고 있음(Presence) */
  present?: boolean;
  /** 시간대를 아직 모를 때(상대가 앱을 처음 열기 전) 빈 칸 대신 보여줄 말 */
  placeholder?: string;
  className?: string;
}) {
  const sleeping = timeZone ? isLikelySleeping(timeZone, now) : false;
  // 두 사람의 하늘이 다르다는 것 자체가 시차의 시각화다(Calm Technology —
  // 숫자를 읽지 않아도 느껴지게). 시간대를 모르거나 하이드레이션 전엔 중립색.
  const sky = timeZone ? SKY_CLASS[skyPhase(timeZone, now)] : "bg-muted";

  return (
    <div
      className={cn(
        "duration-slow ease-standard flex min-h-48 flex-col gap-1 px-4 pt-5 pb-20 transition-colors",
        sky,
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <span className="opacity-75">{label}</span>
        {present && (
          <>
            <span aria-hidden className="bg-success size-2 rounded-full" />
            <span className="sr-only">지금 앱을 보고 있어요</span>
          </>
        )}
      </span>
      {timeZone ? (
        <span className="mt-1 text-3xl font-bold tracking-tight" suppressHydrationWarning>
          {formatTime(now, timeZone)}
        </span>
      ) : (
        placeholder && (
          <span className="text-muted-foreground mt-1 text-sm leading-snug">{placeholder}</span>
        )
      )}
      {weather && (
        <span className="flex items-center gap-1 text-sm opacity-85">
          <WeatherIcon code={weather.weatherCode} className="size-4" /> {weather.description}{" "}
          {Math.round(weather.temperatureC)}°
        </span>
      )}
      {sleeping && (
        <span className="mt-2 flex items-center gap-1 text-sm font-medium">
          <Moon className="size-4" /> 자고 있을 시간
        </span>
      )}
    </div>
  );
}

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
          <span className="text-dusk-ink mt-2 text-sm font-medium">
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

// "우리" 탭의 주인공 장면(DESIGN.md §2 Calm Technology, §4). 흘끗 보면 되는
// 정보 — 서로의 현지 시각·날씨·수면 상태·거리 — 를 숫자 나열이 아니라 두
// 사람이 나란히 선 한 장면으로 압축한다. 가운데 기댄 모티프(§1)가 두 영역을
// 잇고, 누르면 위치 시트가 열린다.
export function UsScene() {
  const { summary } = useSpace();
  const { km, approaching, meetingSoon } = useDistance();
  const partnerPresent = usePartnerPresent();
  const now = useNow(30_000);
  const partnerName = displayName(summary.partner, "상대");
  // 내 시간대는 서버 저장값보다 지금 이 브라우저가 아는 값이 더 정확하다.
  const myTz = useMyTimeZone();

  const bothRainy =
    !!summary.me.weather &&
    !!summary.partner?.weather &&
    isRainOrSnowCode(summary.me.weather.weatherCode) &&
    isRainOrSnowCode(summary.partner.weather.weatherCode);

  if (meetingSoon && km !== null) return <MeetingSoonScene km={km} approaching={approaching} />;

  return (
    <section aria-label="지금 우리" className="px-4">
      <div className="relative grid grid-cols-2 overflow-hidden rounded-xl">
        <Side label="나" timeZone={myTz} weather={summary.me.weather} now={now} />
        <Side
          label={partnerName}
          timeZone={summary.partner?.timezone ?? null}
          weather={summary.partner?.weather ?? null}
          now={now}
          present={partnerPresent}
          placeholder={`${josa(partnerName, "이/가")} 앱을 열면 시간과 날씨가 여기 채워져요`}
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
      {partnerPresent && (
        <p className="text-muted-foreground mt-2 text-sm">{partnerName}도 지금 함께 보고 있어요</p>
      )}
      {bothRainy && (
        <p className="text-muted-foreground mt-2 text-sm">둘 다 비 오는 날이에요. 우산 챙겼어요?</p>
      )}
    </section>
  );
}
