"use client";

import { Moon, Plane } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { SceneIllustration } from "@/components/brand/scene-illustration";
import { Wordmark } from "@/components/brand/wordmark";
import { useFormat } from "@/i18n/use-format";
import { bestTimes, flightProgress, greatCirclePoint, pickFlight } from "@/lib/flight";
import { skyPhase, skyPhaseAtLongitude, type SkyPhase } from "@/lib/sky";
import { isLikelySleeping } from "@/lib/timezone";
import { useNow } from "@/lib/use-now";
import { isRainOrSnowCode, WeatherIcon, weatherMessageKey } from "@/lib/weather-codes";
import { useFlights, type FlightView } from "./flights";
import { useDistance } from "./location-context";
import { LocationSheet } from "./location-sheet";
import { usePartnerPresent } from "./presence-context";
import { useMyTimeZone, usePartnerName, useSpace, type HomeSummary } from "./space-context";

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
  const t = useTranslations("scene");
  const tw = useTranslations("weather");
  const fmt = useFormat();
  const sleeping = timeZone ? isLikelySleeping(timeZone, now) : false;
  // 두 사람의 하늘이 다르다는 것 자체가 시차의 시각화다(Calm Technology -
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
            <span className="sr-only">{t("present")}</span>
          </>
        )}
      </span>
      {timeZone ? (
        <span className="mt-1 text-3xl font-bold tracking-tight">{fmt.time(now, timeZone)}</span>
      ) : (
        placeholder && (
          <span className="text-muted-foreground mt-1 text-sm leading-snug">{placeholder}</span>
        )
      )}
      {weather && (
        <span className="flex items-center gap-1 text-sm opacity-85">
          <WeatherIcon code={weather.weatherCode} className="size-4" />{" "}
          {tw(weatherMessageKey(weather.weatherCode))} {Math.round(weather.temperatureC)}°
        </span>
      )}
      {sleeping && (
        <span className="mt-2 flex items-center gap-1 text-sm font-medium">
          <Moon className="size-4" /> {t("sleeping")}
        </span>
      )}
    </div>
  );
}

// 비행 중인 쪽(PRD §3.3.1) - 시각·날씨 대신 "하늘 위"와 진행. 하늘색은
// 추정 위치 경도의 태양시. 실제 이륙·착륙을 모르면 "예정 기준"이라고 밝힌다.
function FlightSide({
  label,
  flight,
  now,
  className,
}: {
  label: string;
  flight: FlightView;
  now: Date;
  className?: string;
}) {
  // 서버 렌더와 하이드레이션이 같은 값을 내도록 분 단위로 내린 시각으로 계산한다
  // (진행 막대 폭·위치는 속성이라 글자처럼 조용히 넘어가지 않는다).
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const progress = flightProgress(flight, minute);
  const { arrivalAt, estimated } = bestTimes(flight);
  const t = useTranslations("scene");
  const fmt = useFormat();
  const remaining = fmt.remaining(arrivalAt.getTime() - minute.getTime());
  const here = greatCirclePoint(flight.from, flight.to, progress);
  const sky = SKY_CLASS[skyPhaseAtLongitude(here.lng, minute)];

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
        <Plane className="size-3.5 opacity-75" aria-hidden />
      </span>
      <span className="mt-1 text-3xl font-bold tracking-tight">{t("inTheAir")}</span>
      <span className="flex justify-between text-sm opacity-85">
        <span>{flight.from.city}</span>
        <span>{flight.to.city}</span>
      </span>
      <FlightTrail
        progress={progress}
        label={t("routeLabel", { from: flight.from.city, to: flight.to.city })}
      />
      <span className="text-sm">
        {remaining ? t("remaining", { time: remaining }) : t("landingSoon")}
      </span>
      {estimated && <span className="text-xs opacity-70">{t("scheduled")}</span>}
    </div>
  );
}

// 비행 궤적 - 출발에서 도착까지 둥근 호(컨셉아트의 점선 비행 궤적). 지나온
// 길은 점으로 남고, 비행기는 호의 그 지점에서 진행 방향을 바라본다. 상자 비율을
// viewBox와 같게 고정해 비행기(HTML 아이콘)를 백분율 좌표로 그대로 올린다.
const TRAIL = { w: 200, h: 30, p0: [6, 24], c: [100, -4], p1: [194, 24] } as const;

function trailAt(t: number) {
  const { p0, c, p1 } = TRAIL;
  const lerp = (a: readonly number[], b: readonly number[]) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  const q0 = lerp(p0, c);
  const q1 = lerp(c, p1);
  const pt = [q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t];
  const angle = (Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) * 180) / Math.PI;
  return { q0, pt, angle };
}

function FlightTrail({ progress, label }: { progress: number; label: string }) {
  const { p0, c, p1, w, h } = TRAIL;
  const { q0, pt, angle } = trailAt(progress);
  return (
    <span
      className="relative mt-1 block"
      style={{ aspectRatio: `${w} / ${h}` }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 size-full" aria-hidden>
        <path
          d={`M${p0} Q${c} ${p1}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
        <path
          d={`M${p0} Q${q0} ${pt}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="0 7"
        />
        <circle cx={p1[0]} cy={p1[1]} r={3} fill="currentColor" fillOpacity={0.5} />
      </svg>
      {/* lucide Plane은 오른쪽 위(-45도)를 향한다 - 진행 방향 각도에 45도를 더한다. */}
      <Plane
        aria-hidden
        className="absolute size-4 -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${(pt[0] / w) * 100}%`,
          top: `${(pt[1] / h) * 100}%`,
          rotate: `${angle + 45}deg`,
        }}
      />
    </span>
  );
}

// "곧 만나요" - 거리가 임계값 안으로 들어오면(src/lib/geo.ts) 둘로 나뉜 장면
// 대신 두 사람이 한 장면에 모인다. 상황 카드보다 우선하는 최상위 상태라
// 카드가 아니라 장면 자체를 바꾼다(PRD §3.3 만남 모드, §3.7 우선순위).
function MeetingSoonScene({ km, approaching }: { km: number; approaching: boolean }) {
  const t = useTranslations("scene");
  const fmt = useFormat();
  return (
    <section aria-label={t("meetingSoon")} className="px-4">
      <LocationSheet>
        <button
          type="button"
          className="bg-sky-dusk relative flex min-h-56 w-full flex-col items-start justify-end gap-1 overflow-hidden rounded-xl px-5 pt-5 pb-6 text-left"
        >
          {/* 곧 안게 될 두 사람 - 그림 배경이 sky-dusk와 거의 같은 단색이라, 왼쪽과 위
              가장자리만 녹여 카드와 이음매 없이 잇는다. */}
          <div
            className="absolute right-0 bottom-0 w-36"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, #000 12%), linear-gradient(to bottom, transparent, #000 10%)",
              maskComposite: "intersect",
            }}
          >
            <SceneIllustration scene="meet" sizes="9rem" />
          </div>
          <span className="text-dusk-ink relative text-sm font-medium">
            {approaching ? t("approaching") : t("near")}
          </span>
          <span className="text-foreground relative text-3xl font-bold tracking-tight">
            {t("meetingSoon")}
          </span>
          <span className="text-foreground relative text-5xl font-bold tracking-tight">
            {fmt.distance(km)}
          </span>
        </button>
      </LocationSheet>
    </section>
  );
}

// "우리" 탭의 주인공 장면(DESIGN.md §2 Calm Technology, §4). 흘끗 보면 되는
// 정보 - 서로의 현지 시각·날씨·수면 상태·거리 - 를 숫자 나열이 아니라 두
// 사람이 나란히 선 한 장면으로 압축한다. 가운데 기댄 모티프(§1)가 두 영역을
// 잇고, 누르면 위치 시트가 열린다.
export function UsScene() {
  const { currentUserId, summary } = useSpace();
  const { km, approaching, meetingSoon } = useDistance();
  const partnerPresent = usePartnerPresent();
  const now = useNow(30_000);
  const t = useTranslations("scene");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const partnerName = usePartnerName();
  const flights = useFlights();
  const picked = flights.data ? pickFlight(flights.data, now) : null;
  const flying = picked?.phase === "inFlight" ? picked.flight : null;
  const iAmFlying = flying?.travelerId === currentUserId;
  // 내 시간대는 서버 저장값보다 지금 이 브라우저가 아는 값이 더 정확하다.
  const myTz = useMyTimeZone();

  const bothRainy =
    !!summary.me.weather &&
    !!summary.partner?.weather &&
    isRainOrSnowCode(summary.me.weather.weatherCode) &&
    isRainOrSnowCode(summary.partner.weather.weatherCode);

  if (meetingSoon && km !== null) return <MeetingSoonScene km={km} approaching={approaching} />;

  return (
    <section aria-label={t("label")} className="px-4">
      <div className="relative grid grid-cols-2 overflow-hidden rounded-xl">
        {flying && iAmFlying ? (
          <FlightSide label={tc("me")} flight={flying} now={now} />
        ) : (
          <Side label={tc("me")} timeZone={myTz} weather={summary.me.weather} now={now} />
        )}
        {flying && !iAmFlying ? (
          <FlightSide label={partnerName} flight={flying} now={now} />
        ) : (
          <Side
            label={partnerName}
            timeZone={summary.partner?.timezone ?? null}
            weather={summary.partner?.weather ?? null}
            now={now}
            present={partnerPresent}
            placeholder={t("partnerPlaceholder", fmt.particles(partnerName))}
          />
        )}
        <LocationSheet>
          {flying ? (
            // 비행 중엔 두 사람 사이 거리 대신 비행 경로를 연다.
            <button
              type="button"
              aria-label={t("seeRouteLabel")}
              className="bg-background shadow-soft text-foreground absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full py-2.5 pr-4 pl-3 text-sm font-semibold"
            >
              <Plane className="text-dusk-ink size-5" />
              {t("seeRoute")}
            </button>
          ) : (
            <button
              type="button"
              aria-label={t("seeLocation")}
              className="bg-background shadow-soft text-foreground absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full py-1.5 pr-4 pl-2 text-sm font-semibold"
            >
              <Wordmark className="size-9" />
              {km !== null ? fmt.distance(km) : t("seeLocation")}
            </button>
          )}
        </LocationSheet>
      </div>
      {partnerPresent && (
        <p className="text-muted-foreground mt-2 text-sm">
          {t("partnerPresent", { name: partnerName })}
        </p>
      )}
      {bothRainy && <p className="text-muted-foreground mt-2 text-sm">{t("bothRainy")}</p>}
    </section>
  );
}
