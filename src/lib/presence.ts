// Supabase Presence 상태(presenceState()) - key(=userId)별로 그 사용자가 연
// 탭/기기 목록이 들어 있다. 상대 key에 하나라도 있으면 지금 보고 있는 것.
export type PresenceState = Record<string, unknown[]>;

export function isPartnerPresent(state: PresenceState, currentUserId: string) {
  return Object.entries(state).some(
    ([userId, sessions]) => userId !== currentUserId && sessions.length > 0,
  );
}
