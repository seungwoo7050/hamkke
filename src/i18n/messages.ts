import en from "../../messages/en.json";
import ko from "../../messages/ko.json";
import type { Locale } from "./config";

// 서버(tRPC 에러·푸시 알림)와 테스트가 요청 컨텍스트 없이 문구를 쓰려고 모든
// 언어 파일을 한곳에서 들고 있는다. 화면은 getRequestConfig가 고른 한 언어만 받는다.
export const MESSAGES = { ko, en } satisfies Record<Locale, unknown>;
export type Messages = typeof ko;
