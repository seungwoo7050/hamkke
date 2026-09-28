/** "방금" · "5분 전" · "3시간 전" · "2일 전" - 주변부 정보용 거친 상대 시각. */
export function relativeTime(from: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 문장 앞에 붙는 부사형 - "3시간 전에 …", "방금 …". */
export function relativeTimeAdverb(from: Date, now: Date) {
  const label = relativeTime(from, now);
  return label === "방금" ? label : `${label}에`;
}
