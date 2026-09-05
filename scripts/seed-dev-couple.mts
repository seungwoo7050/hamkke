/**
 * 로컬 개발 편의용 — 매번 페어링 절차(초대코드 생성/입력)를 거치지 않고
 * 이미 페어링된 테스트 커플 계정 두 개를 만든다. 프로덕션 코드 경로에는
 * 전혀 관여하지 않는, 이 스크립트 실행자만 쓰는 1회성 DB 시드다.
 *
 * 실행: npm run dev:seed-couple
 *
 * 재실행해도 안전하다 — 고정된 이메일(dev-a/dev-b@hamkke.test)을 upsert하고
 * 세션만 새로 발급한다.
 */
import { randomBytes } from "node:crypto";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SESSION_DAYS = 30;

async function main() {
  const existingA = await prisma.user.findUnique({ where: { email: "dev-a@hamkke.test" } });

  const space =
    existingA?.spaceId != null
      ? await prisma.space.findUnique({ where: { id: existingA.spaceId } })
      : await prisma.space.create({
          data: {
            status: "active",
            inviteCode: randomBytes(4).toString("hex").toUpperCase(),
            inviteCodeExpiresAt: new Date(Date.now() + 365 * 86400000),
          },
        });

  if (!space) throw new Error("space를 찾거나 만들지 못했어요");
  if (space.status !== "active") {
    await prisma.space.update({ where: { id: space.id }, data: { status: "active" } });
  }

  const userA = await prisma.user.upsert({
    where: { email: "dev-a@hamkke.test" },
    create: { email: "dev-a@hamkke.test", name: "개발용-A", spaceId: space.id },
    update: { spaceId: space.id },
  });
  const userB = await prisma.user.upsert({
    where: { email: "dev-b@hamkke.test" },
    create: { email: "dev-b@hamkke.test", name: "개발용-B", spaceId: space.id },
    update: { spaceId: space.id },
  });

  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.session.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  const sessionA = await prisma.session.create({
    data: { sessionToken: randomBytes(32).toString("hex"), userId: userA.id, expires },
  });
  const sessionB = await prisma.session.create({
    data: { sessionToken: randomBytes(32).toString("hex"), userId: userB.id, expires },
  });

  console.log(`
페어링된 테스트 계정 두 개 준비 완료 (${SESSION_DAYS}일간 유효).

크롬 개발자도구 → Application(또는 저장공간) → Cookies → http://localhost:3000
에서 아래 값으로 authjs.session-token 쿠키를 각각 설정하세요.

  일반 창(A 계정, "개발용-A"):
    authjs.session-token = ${sessionA.sessionToken}

  시크릿 창(B 계정, "개발용-B") — 일반 창과 별개 쿠키라 동시에 둘 다 로그인 상태로 열어둘 수 있어요:
    authjs.session-token = ${sessionB.sessionToken}

쿠키 설정 후 http://localhost:3000/home 으로 이동하면 바로 로그인된 상태로 보여요.
`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
