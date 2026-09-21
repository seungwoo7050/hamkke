-- Realtime private 채널 권한(docs/ARCHITECTURE.md §4). realtime.messages는 Supabase가
-- 관리하는 스키마라 Supabase에서만 만들고, realtime 스키마가 없는 로컬 Postgres에서는
-- 아무것도 하지 않는다. 토큰(src/server/realtime-token.ts)의 space_id 클레임과 채널
-- 이름(src/lib/supabase/channels.ts)이 맞을 때만 허용한다. sub는 cuid라 auth.uid()를
-- 쓰지 않는다. 서버 브로드캐스트는 secret key라 이 정책을 거치지 않는다.
DO $migration$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages 없음 — Realtime 정책 건너뜀(로컬 Postgres)';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "hamkke: space members receive" ON realtime.messages';
  EXECUTE 'DROP POLICY IF EXISTS "hamkke: space members send typing and presence" ON realtime.messages';

  -- 받기: 자기 스페이스의 Broadcast 채널과 Presence 채널.
  EXECUTE $policy$
    CREATE POLICY "hamkke: space members receive" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      (auth.jwt() ->> 'space_id') IS NOT NULL
      AND (
        (realtime.messages.extension = 'broadcast'
          AND (SELECT realtime.topic()) = 'space:' || (auth.jwt() ->> 'space_id'))
        OR (realtime.messages.extension = 'presence'
          AND (SELECT realtime.topic()) = 'space:' || (auth.jwt() ->> 'space_id') || ':presence')
      )
    )
  $policy$;

  -- 보내기: 클라이언트가 직접 보내는 것은 타이핑 신호와 Presence뿐이다. 메시지·위치·
  -- 터치 같은 이벤트는 서버만 보내므로, 멤버가 가짜 이벤트를 흘리는 것도 막힌다.
  EXECUTE $policy$
    CREATE POLICY "hamkke: space members send typing and presence" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (
      (auth.jwt() ->> 'space_id') IS NOT NULL
      AND (
        (realtime.messages.extension = 'broadcast'
          AND realtime.messages.event = 'typing'
          AND (SELECT realtime.topic()) = 'space:' || (auth.jwt() ->> 'space_id'))
        OR (realtime.messages.extension = 'presence'
          AND (SELECT realtime.topic()) = 'space:' || (auth.jwt() ->> 'space_id') || ':presence')
      )
    )
  $policy$;
END
$migration$;
