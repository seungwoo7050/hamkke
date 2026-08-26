import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const status = await getCurrentPairingStatus();
  if (status.status !== "active") {
    redirect("/onboarding");
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">연결됐어요</h1>
        <p className="text-muted-foreground max-w-sm">
          상대와 연결이 완료됐어요. 채팅, 위치 공유 같은 기능은 다음 단계에서 만나요.
        </p>
      </div>
      <form action={handleSignOut}>
        <Button type="submit" variant="outline">
          로그아웃
        </Button>
      </form>
    </main>
  );
}
