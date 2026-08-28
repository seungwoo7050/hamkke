import "server-only";
import { getAdminMessaging } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string },
) {
  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  const messaging = getAdminMessaging();
  const results = await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({ token: t.token, notification, webpush: { fcmOptions: { link: "/" } } }),
    ),
  );

  // 브라우저가 알림을 취소했거나 오래돼서 더 이상 유효하지 않은 토큰은 정리한다.
  const staleTokenIds = results.flatMap((result, i) => {
    if (result.status !== "rejected") return [];
    const code = (result.reason as { errorInfo?: { code?: string } } | undefined)?.errorInfo?.code;
    return code === "messaging/registration-token-not-registered" ? [tokens[i].id] : [];
  });

  if (staleTokenIds.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: staleTokenIds } } });
  }
}

/** Space의 "상대방"(발신자 본인이 아닌 다른 멤버)에게만 발송한다. */
export async function sendPushToSpacePartner(
  spaceId: string,
  excludeUserId: string,
  notification: { title: string; body: string },
) {
  const partner = await prisma.user.findFirst({
    where: { spaceId, id: { not: excludeUserId } },
    select: { id: true },
  });
  if (!partner) return;
  await sendPushToUser(partner.id, notification);
}
