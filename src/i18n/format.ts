// 언어별 표기 부품(ARCHITECTURE.md §12) — 문구 파일(ICU)로 안 되는 것만 여기 둔다.
// 한국어는 기존 함수(src/lib/datetime.ts 등)를 그대로 써서 표기가 바뀌지 않고,
// 영어는 어느 실행 환경에나 있는 en-US ICU 데이터로 만든다. 새 언어를 더할 때
// Intl만으로 충분하면 영어 분기를 그 언어 코드로 일반화하고, 한국어처럼 따로
// 조립해야 하는 언어만 분기를 더한다.
import {
  formatDateTime as koDateTime,
  formatDayLabel as koDayLabel,
  formatTime as koTime,
  formatYMD as koYMD,
  daysBetween,
  todayIn,
  weekdayOf,
  type YMD,
} from "@/lib/datetime";
import { formatDistanceKm as koDistance } from "@/lib/geo";
import { josa } from "@/lib/josa";
import {
  relativeTime as koRelative,
  relativeTimeAdverb as koRelativeAdverb,
} from "@/lib/relative-time";
import type { Locale } from "./config";

const ymdDate = ({ y, m, d }: YMD) => new Date(Date.UTC(y, m - 1, d, 12));

function enYMD(ymd: YMD, opts: { year?: boolean; weekday?: boolean } = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(opts.year ? { year: "numeric" } : {}),
    ...(opts.weekday ? { weekday: "short" } : {}),
  }).format(ymdDate(ymd));
}

function enTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(
    date,
  );
}

function enRelative(from: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
  if (minutes < 1) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.floor(hours / 24), "day");
}

/**
 * 이름·편명 뒤에 붙는 말. 한국어는 받침에 따라 조사가 달라 문구 파일이 미리
 * 붙인 형태({nameSubj} = "지우가")를 쓰고, 다른 언어는 원래 말({name})을 쓴다.
 */
export type Particles<P extends string> = Record<
  P | `${P}Subj` | `${P}Topic` | `${P}Obj` | `${P}With`,
  string
>;

export function formatters(locale: Locale) {
  const ko = locale === "ko";
  return {
    locale,
    /** "오후 3:12" · "3:12 PM" */
    time: (date: Date, timeZone: string) => (ko ? koTime(date, timeZone) : enTime(date, timeZone)),
    /** "10월 14일 (수)" · "Wed, Oct 14" */
    ymd: (ymd: YMD, opts?: { year?: boolean; weekday?: boolean }) =>
      ko ? koYMD(ymd, opts) : enYMD(ymd, opts),
    /** "9월 29일 (화) 오후 9:00" · "Tue, Sep 29, 9:00 PM" */
    dateTime: (date: Date, timeZone: string, opts: { weekday?: boolean } = {}) => {
      if (ko) return koDateTime(date, timeZone, opts);
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...((opts.weekday ?? true) ? { weekday: "short" } : {}),
      }).format(date);
    },
    /** 채팅 날짜 구분선 — "오늘"·"어제"·날짜 / "Today"·"Yesterday"·date */
    dayLabel: (date: Date, timeZone: string, now: Date) => {
      if (ko) return koDayLabel(date, timeZone, now);
      const target = todayIn(timeZone, date);
      const today = todayIn(timeZone, now);
      const diff = daysBetween(target, today);
      if (diff === 0) return "Today";
      if (diff === 1) return "Yesterday";
      return enYMD(target, { weekday: true, year: target.y !== today.y });
    },
    /** "3시간 전" · "3 hours ago" */
    relative: (from: Date, now: Date) => (ko ? koRelative(from, now) : enRelative(from, now)),
    /** 문장 속 부사형 — "3시간 전에" · "3 hours ago" */
    relativeAdverb: (from: Date, now: Date) =>
      ko ? koRelativeAdverb(from, now) : enRelative(from, now),
    /** 남은 시간 "7시간 10분" · "7h 10m". 1분 이하면 null(문구 파일의 "곧 착륙"). */
    remaining: (ms: number) => {
      const minutes = Math.ceil(ms / 60_000);
      if (minutes <= 1) return null;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (ko) return h === 0 ? `${m}분` : m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
      return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
    },
    /** 요일 한 글자 "화" · "Tue" */
    weekday: (ymd: YMD) =>
      ko
        ? weekdayOf(ymd)
        : new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(
            ymdDate(ymd),
          ),
    /** 저장 용량 — "312.5MB"·"1GB" / "312.5 MB"·"1 GB"(1GB 미만은 MB) */
    bytes: (n: number) => {
      const gb = n / 1024 ** 3;
      const [value, unit] = gb >= 1 ? [gb, "gigabyte"] : [n / 1024 ** 2, "megabyte"];
      return new Intl.NumberFormat(ko ? "ko-KR" : "en-US", {
        style: "unit",
        unit,
        maximumFractionDigits: value >= 100 ? 0 : 1,
      }).format(value);
    },
    /** "11,053km" · "11,053 km" */
    distance: (km: number) =>
      ko
        ? koDistance(km)
        : km < 1
          ? `${Math.round(km * 1000)} m`
          : `${km.toLocaleString("en-US", { maximumFractionDigits: km >= 100 ? 0 : 1 })} km`,
    /** 목록용 D-day — "D-18"·"오늘"·"D+3" / "in 18 days"·"Today"·"3 days ago" */
    dday: (days: number) => {
      if (ko) return days === 0 ? "오늘" : days > 0 ? `D-${days}` : `D+${-days}`;
      if (days === 0) return "Today";
      const n = Math.abs(days);
      const unit = n === 1 ? "day" : "days";
      return days > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
    },
    /** 크게 보여줄 D-day — "D-18" / "18 days"(영어엔 D-day 표기 관습이 없다) */
    ddayBig: (days: number) => {
      if (ko) return days === 0 ? "오늘" : days > 0 ? `D-${days}` : `D+${-days}`;
      if (days === 0) return "Today";
      const n = Math.abs(days);
      return `${n} ${n === 1 ? "day" : "days"}${days < 0 ? " ago" : ""}`;
    },
    /** 문구 파일 변수로 넘길 이름·편명 — particles("지우") → {name, nameSubj, …} */
    particles: <P extends string = "name">(word: string, prefix?: P): Particles<P> => {
      const p = (prefix ?? "name") as P;
      const pick = (pair: Parameters<typeof josa>[1]) => (ko ? josa(word, pair) : word);
      return {
        [p]: word,
        [`${p}Subj`]: pick("이/가"),
        [`${p}Topic`]: pick("은/는"),
        [`${p}Obj`]: pick("을/를"),
        [`${p}With`]: pick("과/와"),
      } as Particles<P>;
    },
  };
}

export type Formatters = ReturnType<typeof formatters>;
