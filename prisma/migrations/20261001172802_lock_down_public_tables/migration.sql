-- 앱 테이블 보호(2026-10-02 보안 사고의 이중 방어). 앱 테이블은 public 스키마에 있고,
-- Supabase Data API(PostgREST)는 이 스키마를 공개 키 역할(anon)과 로그인 역할
-- (authenticated)로 노출할 수 있다. 앱은 Data API를 쓰지 않는다 — 데이터는 서버의
-- Prisma만 읽고 쓰고, Prisma는 테이블 소유자로 접속해 RLS를 거치지 않는다.
--
-- 1) 모든 테이블에 RLS를 켠다. 정책이 없으므로 소유자가 아닌 역할에는 아무 행도
--    보이지 않는다. 새 테이블은 src/server/db-security.test.ts가 빠뜨리지 않게 지킨다.
-- 2) Supabase에만 있는 anon·authenticated 역할의 권한을 회수하고, 앞으로 만들 테이블에도
--    기본 권한이 붙지 않게 한다. 그 역할이 없는 로컬 Postgres에서는 건너뛴다.
DO $migration$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
  ELSE
    RAISE NOTICE 'anon/authenticated 역할 없음 — 권한 회수 건너뜀(로컬 Postgres)';
  END IF;
END
$migration$;
