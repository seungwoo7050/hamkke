import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { isPrivateRealtimeEnabled } from "@/server/realtime-token";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { NowSeedProvider } from "@/lib/use-now";
import { appRouter } from "@/server/trpc/routers/_app";
import { AppEffects } from "./app-effects";
import { BottomNav } from "./bottom-nav";
import { LocationProvider } from "./location-context";
import { PresenceProvider } from "./presence-context";
import { SpaceRealtimeProvider } from "./realtime-context";
import { SpaceProvider } from "./space-context";
import { TouchReceived } from "./touch-received";

const createCaller = createCallerFactory(appRouter);

// 이 요청을 그린 시각 — 클라이언트 시계(useNow)의 첫 값으로 내려 보낸다.
function renderedAt() {
  return Date.now();
}

// 우리/대화/기억 3탭 공통 골격(DESIGN.md §4). 인증·페어링 가드와 탭과 무관하게
// 앱이 열려 있는 동안 계속 살아 있어야 하는 것(푸시 등록, 타임존 동기화,
// 터치 수신, 위치 감시)을 여기서 한 번만 건다 — 탭을 옮길 때마다 끊기면 안 된다.
export default async function HomeLayout({ children }: LayoutProps<"/home">) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const status = await getCurrentPairingStatus();
  if (status.status !== "active") {
    redirect("/onboarding");
  }

  const caller = createCaller(await createTRPCContext());
  const [summary, partnerStatus] = await Promise.all([
    caller.home.summary(),
    caller.location.partnerStatus(),
  ]);

  // Realtime private 채널 전환 여부 — 서버에 서명 키가 있을 때만(없으면 공개 채널).
  const privateChannel = isPrivateRealtimeEnabled();

  return (
    <NowSeedProvider value={renderedAt()}>
      <SpaceProvider value={{ spaceId: status.spaceId, currentUserId: session.user.id, summary }}>
        <SpaceRealtimeProvider spaceId={status.spaceId} privateChannel={privateChannel}>
          <LocationProvider
            currentUserId={session.user.id}
            initialSharing={summary.me.locationSharingEnabled}
            initialPartnerStatus={partnerStatus}
          >
            <PresenceProvider
              spaceId={status.spaceId}
              currentUserId={session.user.id}
              privateChannel={privateChannel}
            >
              <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
                <AppEffects currentUserId={session.user.id} />
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
                <BottomNav />
              </div>
              <TouchReceived />
            </PresenceProvider>
          </LocationProvider>
        </SpaceRealtimeProvider>
      </SpaceProvider>
    </NowSeedProvider>
  );
}
