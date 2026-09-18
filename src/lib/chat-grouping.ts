import { partsIn } from "./datetime";

// 채팅 말풍선 묶음(카카오톡 등 한국어 메신저의 익숙한 문법): 같은 사람이 같은
// 분(minute)에 연달아 보낸 메시지는 한 묶음이다. 묶음의 마지막 말풍선에만
// 시각을 달고, 묶음 안쪽 모서리를 줄여 한 덩어리로 보이게 한다. 사이에 터치나
// 날짜 구분선이 끼면 묶음이 끊긴다.

export type GroupableItem =
  { kind: "message"; senderId: string; at: Date } | { kind: "touch"; at: Date };

export type GroupPosition = { first: boolean; last: boolean };

function minuteKey(at: Date, timeZone: string) {
  const { y, m, d, hour, minute } = partsIn(at, timeZone);
  return `${y}-${m}-${d} ${hour}:${minute}`;
}

function sameGroup(a: GroupableItem | undefined, b: GroupableItem | undefined, timeZone: string) {
  return (
    a?.kind === "message" &&
    b?.kind === "message" &&
    a.senderId === b.senderId &&
    minuteKey(a.at, timeZone) === minuteKey(b.at, timeZone)
  );
}

/** 각 항목의 묶음 안 위치. 터치 항목은 항상 단독(first·last 모두 true). */
export function groupPositions(items: GroupableItem[], timeZone: string): GroupPosition[] {
  return items.map((item, i) => ({
    first: !sameGroup(items[i - 1], item, timeZone),
    last: !sameGroup(item, items[i + 1], timeZone),
  }));
}
