import type { Locale } from "./config";
import type { Messages } from "./messages";

// 문구 키에 타입을 붙인다 — 없는 키를 쓰거나 한 언어에 빠진 키가 있으면 타입
// 검사에서 실패한다(ARCHITECTURE.md §12 품질 게이트).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
