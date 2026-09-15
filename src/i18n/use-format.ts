"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { formatters } from "./format";

/** 화면에서 쓰는 언어별 표기 부품(src/i18n/format.ts). */
export function useFormat() {
  const locale = useLocale();
  return useMemo(() => formatters(locale), [locale]);
}
