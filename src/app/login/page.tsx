import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, emailLoginEnabled, signIn } from "@/auth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTranslations } from "next-intl/server";
import { clientIpFrom, magicLinkChecks } from "@/server/magic-link-limit";
import { retryAfterMs } from "@/server/rate-limit";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) {
    redirect("/onboarding");
  }
  const t = await getTranslations("login");
  const { limited, deleted } = await searchParams;
  const limitedMinutes = typeof limited === "string" ? Number(limited) : NaN;

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/onboarding" });
  }

  async function signInWithEmail(formData: FormData) {
    "use server";
    const email = formData.get("email");
    // 발송 한도(src/server/magic-link-limit.ts)에 걸렸으면 Auth.js 오류 화면 대신
    // 여기서 남은 시간을 안내한다. 실제 차단은 발송 직전(src/auth.ts)에서 한다.
    if (typeof email === "string") {
      const wait = await retryAfterMs(magicLinkChecks(email, clientIpFrom(await headers())));
      if (wait > 0) redirect(`/login?limited=${Math.max(1, Math.ceil(wait / 60_000))}`);
    }
    await signIn("resend", { email, redirectTo: "/onboarding" });
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <Logo className="text-xl" />
      {deleted === "1" && (
        <p role="status" className="bg-muted text-foreground rounded-lg px-4 py-3 text-sm">
          {t("deleted")}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-sm">{t("description")}</p>
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          {t("google")}
        </Button>
      </form>

      {emailLoginEnabled && (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <span className="bg-border h-px flex-1" />
            {t("or")}
            <span className="bg-border h-px flex-1" />
          </div>

          <form action={signInWithEmail} className="flex flex-col gap-3">
            <Input type="email" name="email" placeholder={t("emailPlaceholder")} required />
            {limitedMinutes > 0 && (
              <p role="alert" className="text-destructive text-sm">
                {t("rateLimited", { minutes: limitedMinutes })}
              </p>
            )}
            <Button type="submit" className="w-full">
              {t("emailSubmit")}
            </Button>
          </form>
        </>
      )}

      <p className="text-muted-foreground text-xs break-keep">
        {t.rich("agree", {
          terms: (chunks) => <LegalLink href="/legal/terms">{chunks}</LegalLink>,
          privacy: (chunks) => <LegalLink href="/legal/privacy">{chunks}</LegalLink>,
        })}
      </p>
    </main>
  );
}

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}
