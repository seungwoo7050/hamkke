/**
 * Realtime private 채널용 JWT 서명 키(ES256)를 만든다(docs/ARCHITECTURE.md §4).
 *
 * 실행: npx tsx scripts/generate-supabase-jwt-key.mts
 *
 * 출력된 JWK를 Supabase 대시보드 → Project Settings → JWT Keys에서 새 standby
 * 키로 가져온 뒤 Rotate로 current로 바꾸고, 같은 값을 서버 env
 * SUPABASE_JWT_PRIVATE_KEY에 넣는다(README 배포 체크리스트). kid는 Supabase가
 * 토큰 헤더의 kid로 공개 키를 찾으므로 가져올 때 그대로 둔다.
 *
 * 비공개 키라 출력은 터미널에만 남기고 어디에도 커밋하지 않는다.
 */
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = { ...(await exportJWK(privateKey)), kid: randomUUID() };

console.log("\n① Supabase 대시보드에 가져올 JWK:\n");
console.log(JSON.stringify(jwk, null, 2));
console.log("\n② 서버 env(한 줄):\n");
console.log(`SUPABASE_JWT_PRIVATE_KEY='${JSON.stringify(jwk)}'\n`);
