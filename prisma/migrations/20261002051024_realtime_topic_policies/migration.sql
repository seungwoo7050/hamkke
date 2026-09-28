-- Realtime private 채널 권한을 이벤트가 아니라 토픽 단위로(realtime_space_policies 대체).
-- Realtime은 쓰기 권한을 메시지마다가 아니라 채널에 들어갈 때 한 번, 실제 이벤트 이름이
-- 아닌 값으로 확인한다. 그래서 event = 'typing' 조건은 typing까지 막았다. 대신 채널을
-- 나눈다: 메인 채널(space:<id>)은 서버만 보내고(secret key라 정책을 거치지 않음) 멤버는
-- 받기만, 클라이언트용 채널(space:<id>:presence)은 멤버가 Presence와 타이핑을 주고받는다.
-- 멤버가 메시지·위치·터치 같은 가짜 이벤트를 상대 화면에 흘리지 못하는 것은 그대로다.
DO $migration$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages 없음 — Realtime 정책 건너뜀(로컬 Postgres)';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "hamkke: space members receive" ON realtime.messages';
  EXECUTE 'DROP POLICY IF EXISTS "hamkke: space members send typing and presence" ON realtime.messages';
  EXECUTE 'DROP POLICY IF EXISTS "hamkke: space members send on client channel" ON realtime.messages';

  -- 받기: 자기 스페이스의 두 채널 모두(Presence 채널의 타이핑 broadcast 포함).
  EXECUTE $policy$
    CREATE POLICY "hamkke: space members receive" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      (auth.jwt() ->> 'space_id') IS NOT NULL
      AND (SELECT realtime.topic()) IN (
        'space:' || (auth.jwt() ->> 'space_id'),
        'space:' || (auth.jwt() ->> 'space_id') || ':presence'
      )
    )
  $policy$;

  -- 보내기: 클라이언트용 채널에서만(Presence·타이핑). 메인 채널엔 멤버가 쓸 수 없다.
  EXECUTE $policy$
    CREATE POLICY "hamkke: space members send on client channel" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (
      (auth.jwt() ->> 'space_id') IS NOT NULL
      AND (SELECT realtime.topic()) = 'space:' || (auth.jwt() ->> 'space_id') || ':presence'
    )
  $policy$;
END
$migration$;
