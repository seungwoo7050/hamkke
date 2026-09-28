/**
 * Space의 메인 Broadcast 채널 이름 - 서버만 보내고(메시지·위치·터치 등) 멤버는 받기만
 * 한다. 권한은 private 채널 + RLS가 정한다 - 서버가 서명한 스페이스 토큰의 space_id와
 * 이 이름이 맞을 때만 받을 수 있다(docs/ARCHITECTURE.md §4, 마이그레이션
 * realtime_topic_policies). 이름을 바꾸면 그 정책도 같이 바꿔야 한다.
 */
export function spaceChannelName(spaceId: string) {
  return `space:${spaceId}`;
}

/**
 * 클라이언트용 채널 - 현존감(Presence, PRD §3.2)과 타이핑 신호. 멤버가 직접 보낼 수
 * 있는 유일한 채널이다(정책의 ':presence' 접미사). Realtime은 쓰기 권한을 이벤트가
 * 아니라 채널 단위로 확인하므로, 클라이언트가 보내는 것을 이 채널에 모아 메인 채널을
 * 서버 전용으로 둔다.
 */
export function spacePresenceChannelName(spaceId: string) {
  return `space:${spaceId}:presence`;
}
