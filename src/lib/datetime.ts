// 한국어 날짜·시각 표기를 로케일 데이터(ICU)에 의존하지 않고 직접 만든다.
//
// 왜: Intl의 "ko-KR" 포맷은 실행 환경의 ICU 데이터에 따라 결과가 달라진다 -
// 이 프로젝트의 서버(Node)는 "AM 12:08", 브라우저는 "오전 12:08"을 내서
// 하이드레이션이 깨졌고, 그동안은 시각 문구를 하이드레이션 이후에만 그리는
// 식으로 피해 왔다(첫 화면에서 시각이 한 박자 늦게 채워짐). 숫자 부분은
// 어느 환경에나 있는 en-US 데이터로 뽑고 한국어 조립은 여기서 한다. 그리고
// 항상 명시적인 시간대(사용자 프로필의 IANA 타임존)를 받아, 서버(UTC)와
// 브라우저가 같은 결과를 내게 한다.

export type YMD = { y: number; m: number; d: number };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** 특정 시간대에서 본 그 순간의 달력·시계 값. */
export function partsIn(date: Date, timeZone: string) {
  const p: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: EN_WEEKDAYS.indexOf(p.weekday),
  };
}

/** 그 시간대의 "오늘" 날짜. */
export function todayIn(timeZone: string, now: Date): YMD {
  const { y, m, d } = partsIn(now, timeZone);
  return { y, m, d };
}

/**
 * 시각 없는 날짜 필드(기념일·카운트다운·만남 날짜). "YYYY-MM-DD" 입력이 UTC
 * 자정으로 저장되므로 UTC 기준 달력 값을 그대로 읽는다 - 로컬 시간대로 읽으면
 * 서울보다 늦은 시간대(뉴욕 등)에서 하루 앞 날짜가 된다.
 */
export function dateOnly(stored: Date | string): YMD {
  const date = new Date(stored);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function dayNumber({ y, m, d }: YMD) {
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** from에서 to까지 며칠(음수면 이미 지남). */
export function daysBetween(from: YMD, to: YMD) {
  return Math.round(dayNumber(to) - dayNumber(from));
}

export function weekdayOf(ymd: YMD) {
  return WEEKDAYS[new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay()];
}

/** "11월 2일", 옵션에 따라 "2026년 11월 2일 (월)". */
export function formatYMD(ymd: YMD, opts: { year?: boolean; weekday?: boolean } = {}) {
  const base = `${opts.year ? `${ymd.y}년 ` : ""}${ymd.m}월 ${ymd.d}일`;
  return opts.weekday ? `${base} (${weekdayOf(ymd)})` : base;
}

/** "오후 3:12" */
export function formatTime(date: Date, timeZone: string) {
  const { hour, minute } = partsIn(date, timeZone);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour < 12 ? "오전" : "오후"} ${h12}:${String(minute).padStart(2, "0")}`;
}

/** "9월 29일 (화) 오후 9:00" */
export function formatDateTime(date: Date, timeZone: string, opts: { weekday?: boolean } = {}) {
  const { y, m, d } = partsIn(date, timeZone);
  return `${formatYMD({ y, m, d }, { weekday: opts.weekday ?? true })} ${formatTime(date, timeZone)}`;
}

/** 채팅 날짜 구분선 - "오늘" · "어제" · "9월 29일 (화)". */
export function formatDayLabel(date: Date, timeZone: string, now: Date) {
  const target = todayIn(timeZone, date);
  const diff = daysBetween(target, todayIn(timeZone, now));
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return formatYMD(target, { weekday: true, year: target.y !== todayIn(timeZone, now).y });
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** 반복 기념일을 그해로 옮긴다. 2월 29일은 윤년이 아닌 해에 2월 28일(그 달 안에 머문다). */
function inYear(date: YMD, y: number): YMD {
  if (date.m === 2 && date.d === 29 && !isLeapYear(y)) return { y, m: 2, d: 28 };
  return { ...date, y };
}

/** 기념일의 다음 발생일 - 매년 반복이면 오늘 이후 가장 가까운 해로 옮긴다. */
export function nextOccurrence(date: YMD, recurring: boolean, today: YMD): YMD {
  if (!recurring) return date;
  const thisYear = inYear(date, today.y);
  return daysBetween(today, thisYear) >= 0 ? thisYear : inYear(date, today.y + 1);
}

/**
 * 그 시간대의 벽시계 값("2026-10-14T10:30")을 실제 순간(UTC)으로. 공항 현지
 * 시각으로 입력받는 비행 시각에 쓴다. 오프셋을 한 번 추정하고 DST 경계를
 * 위해 한 번 더 보정한다.
 */
export function fromZonedLocal(value: string, timeZone: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), timeZone);
    const seen = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute);
    guess += wall - seen;
  }
  return new Date(guess);
}

/** 그 시간대에서 본 "YYYY-MM-DDTHH:mm" - fromZonedLocal의 반대(수정 폼 채우기). */
export function toZonedLocal(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hour)}:${pad(p.minute)}`;
}
