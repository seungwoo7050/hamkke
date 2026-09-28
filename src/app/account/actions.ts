"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteAccount } from "@/server/account-deletion";

// Auth.js 세션 쿠키 이름(http는 접두사 없음, https는 __Secure-).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export type DeleteAccountState = { failed: boolean } | null;

/** useActionState용. 실패하면 로그인 상태를 유지한 채 { failed: true } - 다시 시도할 수 있게. */
export async function deleteAccountAction(): Promise<DeleteAccountState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    await deleteAccount(session.user.id);
  } catch (err) {
    console.error("[account] delete failed", err);
    return { failed: true };
  }

  // 세션 행은 계정과 함께 지워졌다. signOut은 없는 세션을 지우려다 오류를 남기므로
  // 쿠키만 직접 지운다.
  const jar = await cookies();
  for (const name of SESSION_COOKIES) jar.delete(name);
  redirect("/login?deleted=1");
}
