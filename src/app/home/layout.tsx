import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { AppEffects } from "./app-effects";
import { BottomNav } from "./bottom-nav";

// 우리/대화/기억 3탭 공통 골격(DESIGN.md §4). 인증·페어링 가드와 탭과 무관하게
// 앱이 열려 있는 동안 계속 살아 있어야 하는 것(푸시 등록, 타임존 동기화,
// 터치 수신)을 여기서 한 번만 건다 — 탭을 옮길 때마다 끊기면 안 된다.
export default async function HomeLayout({ children }: LayoutProps<"/home">) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const status = await getCurrentPairingStatus();
  if (status.status !== "active") {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <AppEffects spaceId={status.spaceId} currentUserId={session.user.id} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      <BottomNav />
    </div>
  );
}
