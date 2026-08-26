import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { PairingPanel } from "./pairing-panel";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const status = await getCurrentPairingStatus();
  if (status.status === "active") {
    redirect("/home");
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">상대와 연결하기</h1>
        <p className="text-muted-foreground max-w-sm">
          초대코드를 만들어 공유하거나, 상대에게 받은 코드를 입력하세요.
        </p>
      </div>

      <PairingPanel initialStatus={status} />
    </main>
  );
}
