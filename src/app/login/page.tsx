import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/onboarding");
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/onboarding" });
  }

  async function signInWithEmail(formData: FormData) {
    "use server";
    const email = formData.get("email");
    await signIn("resend", { email, redirectTo: "/onboarding" });
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">로그인</h1>
        <p className="text-muted-foreground max-w-sm">
          Hamkke는 초대코드로 연결된 두 사람만 사용할 수 있어요.
        </p>
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Google로 계속하기
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span className="bg-border h-px flex-1" />
        또는
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={signInWithEmail} className="flex flex-col gap-3">
        <Input type="email" name="email" placeholder="이메일 주소" required />
        <Button type="submit" className="w-full">
          이메일로 로그인 링크 받기
        </Button>
      </form>
    </main>
  );
}
