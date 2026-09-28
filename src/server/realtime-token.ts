import "server-only";
import { importJWK, SignJWT, type JWK } from "jose";

// Realtime private 채널용 스페이스 전용 JWT(docs/ARCHITECTURE.md §4). Supabase가
// 우리 키(scripts/generate-supabase-jwt-key.mts로 만들어 JWT Keys에 current로
// 가져온 것)로 서명을 검증하고, realtime.messages RLS가 space_id 클레임과 채널
// 이름을 맞춰 본다. sub는 참고용 - 사용자 ID가 cuid라 auth.uid()(uuid 변환)는
// 정책에서 쓰지 않는다.
const TOKEN_TTL_SECONDS = 60 * 60;

function signingJwk(): JWK | null {
  const raw = process.env.SUPABASE_JWT_PRIVATE_KEY;
  return raw ? (JSON.parse(raw) as JWK) : null;
}

/** 키 env가 없으면 private 채널로 전환하기 전 - 공개 채널로 동작한다. */
export function isPrivateRealtimeEnabled() {
  return Boolean(process.env.SUPABASE_JWT_PRIVATE_KEY);
}

export async function signRealtimeToken(userId: string, spaceId: string, now = new Date()) {
  const jwk = signingJwk();
  if (!jwk) return null;

  const key = await importJWK(jwk, "ES256");
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ role: "authenticated", space_id: spaceId })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", ...(jwk.kid ? { kid: jwk.kid } : {}) })
    .setIssuer(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated")
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);
  return { token, expiresAt: expiresAt * 1000 };
}
