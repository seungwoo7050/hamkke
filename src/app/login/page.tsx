import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/onboarding");
  }
  const t = await getTranslations("login");

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
      <Wordmark className="mx-auto" />
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-sm">{t("description")}</p>
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          {t("google")}
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span className="bg-border h-px flex-1" />
        {t("or")}
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={signInWithEmail} className="flex flex-col gap-3">
        <Input type="email" name="email" placeholder={t("emailPlaceholder")} required />
        <Button type="submit" className="w-full">
          {t("emailSubmit")}
        </Button>
      </form>
    </main>
  );
}
