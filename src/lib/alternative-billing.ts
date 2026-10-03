import { Capacitor, registerPlugin } from "@capacitor/core";

// Android 앱의 한국 대체 결제 플러그인(android/.../billing/AlternativeBillingPlugin.kt).
interface AlternativeBillingPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  showInformationDialog(): Promise<{ ok: boolean; code: number }>;
  createReportingToken(): Promise<{ externalTransactionToken: string }>;
}

const AlternativeBilling = registerPlugin<AlternativeBillingPlugin>("AlternativeBilling");

/** Play로 배포한 Android 앱 안인지 - 웹(브라우저)은 Play 결제 정책 밖이다. */
export function isPlayApp() {
  return Capacitor.getPlatform() === "android";
}

/** 이 Play 앱 사용자가 대체 결제로 살 수 있는지(한국 사용자). 웹은 늘 true. */
export async function canCheckoutHere() {
  if (!isPlayApp()) return true;
  return (await AlternativeBilling.isAvailable()).available;
}

export type AppCheckout =
  | { kind: "token"; externalTransactionToken: string }
  | { kind: "unavailable" }
  | { kind: "cancelled" };

/**
 * 앱에서 결제를 시작하기 전 Play가 요구하는 순서: 대체 결제를 쓸 수 있는 사용자인지
 * 확인(한국 사용자) → Google 안내 대화상자 → 이번 거래의 토큰. 쓸 수 없으면 앱 안에서는
 * 결제를 열지 않는다(다른 결제로 유도하는 것도 정책 위반).
 */
export async function prepareAppCheckout(): Promise<AppCheckout> {
  const { available } = await AlternativeBilling.isAvailable();
  if (!available) return { kind: "unavailable" };
  const dialog = await AlternativeBilling.showInformationDialog();
  if (!dialog.ok) return { kind: "cancelled" };
  const { externalTransactionToken } = await AlternativeBilling.createReportingToken();
  return { kind: "token", externalTransactionToken };
}
