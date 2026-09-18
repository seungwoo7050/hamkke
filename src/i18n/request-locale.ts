import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { pickLocale } from "./resolve";

/** 이 요청의 언어 — 한 요청 안에서는 한 번만 계산한다. */
export const getRequestLocale = cache(async () => {
  const [session, h] = await Promise.all([auth(), headers()]);
  return pickLocale({
    userLocale: session?.user?.locale,
    acceptLanguage: h.get("accept-language"),
  });
});
