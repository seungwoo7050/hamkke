import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * secret key 사용 — RLS 우회, 절대 클라이언트에 노출 금지.
 * DB 쓰기(Prisma)가 성공한 뒤 이 클라이언트로 해당 Space 채널에 브로드캐스트한다.
 */
export function createSupabaseServerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}
