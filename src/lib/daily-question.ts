// 하루 한 질문(PRD §3.2) 내장 목록. 콘텐츠 운영(관리자 화면·DB 시드) 없이
// 이 배열 순서대로 순환한다. 질문 문장은 언어마다 messages/*.json의
// questions.<key>에 있다(PRD §3.8 — 두 사람이 같은 질문을 각자의 언어로 본다).
// key는 DailyAnswer.questionKey로 저장되므로 **기존 항목의 key·순서를 바꾸거나 지우지 말고 끝에만 추가한다** — 순서가
// 바뀌면 지난 날짜의 질문이 다른 질문으로 보이게 된다.
export const DAILY_QUESTIONS = [
  { key: "q001" },
  { key: "q002" },
  { key: "q003" },
  { key: "q004" },
  { key: "q005" },
  { key: "q006" },
  { key: "q007" },
  { key: "q008" },
  { key: "q009" },
  { key: "q010" },
  { key: "q011" },
  { key: "q012" },
  { key: "q013" },
  { key: "q014" },
  { key: "q015" },
  { key: "q016" },
  { key: "q017" },
  { key: "q018" },
  { key: "q019" },
  { key: "q020" },
  { key: "q021" },
  { key: "q022" },
  { key: "q023" },
  { key: "q024" },
  { key: "q025" },
  { key: "q026" },
  { key: "q027" },
  { key: "q028" },
  { key: "q029" },
  { key: "q030" },
] as const;

export type DailyQuestion = (typeof DAILY_QUESTIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** 두 사람이 같은 질문을 보도록 UTC 날짜를 키로 쓴다(PRD §3.2). */
export function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function questionForDateKey(dateKey: string): DailyQuestion {
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);
  return DAILY_QUESTIONS[dayNumber % DAILY_QUESTIONS.length];
}

export function questionByKey(key: string): DailyQuestion | undefined {
  return DAILY_QUESTIONS.find((q) => q.key === key);
}
