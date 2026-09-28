"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "@daypicker/react";
import { enUS, ko } from "@daypicker/react/locale";
import { useLocale } from "next-intl";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 달력(DESIGN.md §5 - shadcn/ui calendar와 같은 구조: DayPicker에 토큰 클래스만
 * 입힘). 브라우저 기본 날짜 입력창은 플랫폼마다 모양이 달라 토큰과 어긋났고
 * 다크 모드에서도 튀었다.
 */
// 달력의 월·요일 이름은 DayPicker 자체 로케일을 쓴다(src/i18n/config.ts의 언어마다 하나).
const DAYPICKER_LOCALES = { ko, en: enUS } as const;

function Calendar({ className, classNames, ...props }: DayPickerProps) {
  const locale = useLocale();
  return (
    <DayPicker
      locale={DAYPICKER_LOCALES[locale]}
      showOutsideDays
      className={cn("text-foreground w-full", className)}
      classNames={{
        months: "relative",
        month: "flex flex-col gap-3",
        month_caption: "flex h-9 items-center px-1 text-base font-semibold",
        nav: "absolute top-0 right-0 flex items-center gap-1",
        button_previous:
          "hover:bg-muted duration-fast ease-standard grid size-9 place-items-center rounded-md transition-colors disabled:opacity-40",
        button_next:
          "hover:bg-muted duration-fast ease-standard grid size-9 place-items-center rounded-md transition-colors disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground flex-1 pb-1 text-center text-xs font-medium",
        week: "flex",
        day: "flex-1 p-0.5 text-center",
        day_button:
          "duration-fast ease-standard mx-auto grid size-10 place-items-center rounded-full text-sm transition-colors hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold [&>button]:hover:bg-primary",
        today: "[&>button]:text-primary [&>button]:font-semibold",
        outside: "text-muted-foreground opacity-50",
        disabled: "opacity-30 [&>button]:pointer-events-none",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-5" />
          ) : (
            <ChevronRight className="size-5" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
