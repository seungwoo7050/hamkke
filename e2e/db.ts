import { randomBytes } from "node:crypto";
import "dotenv/config";
import { Pool } from "pg";

// e2e는 사용자·스페이스를 만들고 지운다 — 실수로 운영 DB를 가리키면 안 되므로
// 로컬 호스트가 아니면 명시적으로 허용(E2E_ALLOW_REMOTE_DB=1)하지 않는 한 멈춘다.
// (생성된 Prisma 클라이언트는 ESM이라 Playwright의 CJS 변환과 맞지 않아, 여기선
// 필요한 몇 개의 쿼리만 pg로 직접 쓴다.)
const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1"].includes(host) && process.env.E2E_ALLOW_REMOTE_DB !== "1") {
  throw new Error(
    `e2e는 로컬 DB에서만 돌아요(지금 DATABASE_URL 호스트: ${host || "없음"}). ` +
      "DATABASE_URL=postgresql://...@localhost:5432/... 로 서버와 테스트를 함께 띄워주세요.",
  );
}

const pool = new Pool({ connectionString: url });
const id = () => `e2e${randomBytes(10).toString("hex")}`;

/**
 * 로그인(매직링크 메일·Google)은 자동화할 수 없어, 페어링 전 상태의 사용자와
 * Auth.js DB 세션을 직접 만든다. 쿠키 이름은 http 개발 서버 기준.
 */
export async function createSignedInUser(name: string) {
  const userId = id();
  const sessionToken = randomBytes(32).toString("hex");
  await pool.query(`INSERT INTO "User" (id, email, name) VALUES ($1, $2, $3)`, [
    userId,
    `${userId}@hamkke.test`,
    name,
  ]);
  await pool.query(
    `INSERT INTO "Session" (id, "sessionToken", "userId", expires) VALUES ($1, $2, $3, $4)`,
    [id(), sessionToken, userId, new Date(Date.now() + 86_400_000)],
  );
  return { userId, sessionCookie: { name: "authjs.session-token", value: sessionToken } };
}

export async function spaceOf(userId: string) {
  const { rows } = await pool.query<{ id: string; inviteCode: string }>(
    `SELECT s.id, s."inviteCode" FROM "Space" s JOIN "User" u ON u."spaceId" = s.id WHERE u.id = $1`,
    [userId],
  );
  if (!rows[0]) throw new Error("스페이스가 없어요");
  return rows[0];
}

export async function countLocationPings(userIds: string[]) {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM "LocationPing" WHERE "userId" = ANY($1)`,
    [userIds],
  );
  return Number(rows[0].n);
}

/** 스페이스를 먼저 지우면 메시지·터치·구독 등은 연쇄 삭제되고, 사용자는 따로. */
export async function cleanup(userIds: string[]) {
  await pool.query(
    `DELETE FROM "Space" WHERE id IN (SELECT "spaceId" FROM "User" WHERE id = ANY($1))`,
    [userIds],
  );
  await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [userIds]);
  await pool.end();
}
