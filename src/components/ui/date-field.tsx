"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "cn";
import { formatYMD, type YMD } from "@/lib/datetime";
import { Calendar } from "./calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// 폼 값은 기존 네이티브 입력과 같은 문자열 형식을 그대로 쓴다 — 날짜는
// "YYYY-MM-DD", 날짜+시각은 로컬 "YYYY-MM-DDTHH:mm". 저장 경로를 바꾸지 않고
// 입력 UI만 교체하기 위해서다.

function parseYMD(value: string): YMD {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function toValue({ y, m, d }: YMD) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 달력은 로컬 정오 Date로 주고받는다(자정이면 시간대 경계에서 하루가 밀림).
function toLocalNoon({ y, m, d }: YMD) {
  return new Date(y, m - 1, d, 12);
}

/** 접힌 상태에선 고른 날짜만, 누르면 그 자리에 달력이 펼쳐진다(시트 안 팝오버를 피함). */
export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ymd = parseYMD(value);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 duration-base ease-standard flex h-11 w-full items-center gap-2 rounded-lg border bg-transparent px-3.5 text-left text-base transition-colors outline-none focus-visible:ring-3",
          open && "border-ring",
        )}
      >
        <CalendarDays className="text-muted-foreground size-5" />
        {formatYMD(ymd, { weekday: true, year: ymd.y !== new Date().getFullYear() })}
      </button>
      {open && (
        <div className="border-border mt-1 rounded-lg border p-2">
          <Calendar
            mode="single"
            required
            defaultMonth={toLocalNoon(ymd)}
            selected={toLocalNoon(ymd)}
            onSelect={(date) => {
              onChange(
                toValue({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }),
              );
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 10, 20, 30, 40, 50];

function hourLabel(h: number) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${h12}시`;
}

/** 날짜(달력) + 시·분(선택). 분은 10분 단위 — 약속 시각에 1분 단위는 필요 없다. */
export function DateTimeField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const date = value.slice(0, 10);
  const hour = Number(value.slice(11, 13));
  const minute = Math.floor(Number(value.slice(14, 16)) / 10) * 10;
  const compose = (d: string, h: number, m: number) =>
    `${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-2">
      <DateField label={label} value={date} onChange={(d) => onChange(compose(d, hour, minute))} />
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={String(hour)}
          onValueChange={(h) => onChange(compose(date, Number(h), minute))}
        >
          <SelectTrigger aria-label={`${label} 시`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {hourLabel(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(minute)}
          onValueChange={(m) => onChange(compose(date, hour, Number(m)))}
        >
          <SelectTrigger aria-label={`${label} 분`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {String(m).padStart(2, "0")}분
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** 폼 기본값용 "오늘"(이 기기의 로컬 날짜). toISOString()은 UTC라 새벽엔 하루 전이 된다. */
export function localTodayValue(now: Date = new Date()) {
  return toValue({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}
