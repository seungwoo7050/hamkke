import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { DeleteAccountSection } from "../../home/delete-account-section";

// 계정 삭제 안내(공개 페이지). Google Play는 계정을 만들 수 있는 앱에 앱 밖에서도
// 삭제를 요청할 수 있는 웹 주소를 요구한다 - Play Console에 이 주소를 등록한다.
// 로그인 상태면 여기서 바로 지울 수 있다(설정 시트와 같은 확인 단계).
export default async function DeleteAccountPage() {
  const t = await getTranslations("accountPage");
  const tc = await getTranslations("common");
  const session = await auth();

  let partnerName: string | undefined;
  if (session?.user.spaceId) {
    const partner = await prisma.user.findFirst({
      where: { spaceId: session.user.spaceId, id: { not: session.user.id } },
      select: { name: true },
    });
    if (partner) partnerName = partner.name?.trim() || tc("partner");
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-16">
      <Wordmark className="mx-auto" />
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-foreground font-medium">{t("howTitle")}</h2>
        <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-foreground font-medium">{t("deletedTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("deletedBody")}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-foreground font-medium">{t("keptTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("keptBody")}</p>
      </section>

      {session?.user ? (
        <DeleteAccountSection partnerName={partnerName} />
      ) : (
        <Button asChild className="w-full">
          <Link href="/login">{t("signIn")}</Link>
        </Button>
      )}
    </main>
  );
}
