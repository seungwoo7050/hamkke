// 앱 테이블은 Supabase의 public 스키마에 있고, Supabase Data API(PostgREST)는 이 스키마를
// 공개 키 역할(anon)로 노출할 수 있다. 앱은 Data API를 쓰지 않으므로(Prisma만, 테이블
// 소유자로 접속해 RLS를 거치지 않는다) 모든 테이블에 RLS를 켜 두어, Data API가 켜지거나
// 권한이 다시 생겨도 아무 행도 보이지 않게 한다. 새 테이블을 만들 때 빠뜨리지 않게 지킨다.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

describe("DB 보안", () => {
  it("public 스키마의 모든 테이블에 RLS가 켜져 있다", async () => {
    const rows = await prisma.$queryRaw<{ table: string; rls: boolean }[]>`
      SELECT c.relname AS "table", c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.rls).map((r) => r.table)).toEqual([]);
  });
});
