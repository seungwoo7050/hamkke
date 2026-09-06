// 하루 한 질문(PRD §3.2) 내장 목록. 콘텐츠 운영(관리자 화면·DB 시드) 없이
// 이 배열 순서대로 순환한다. key는 DailyAnswer.questionKey로 저장되므로
// **기존 항목의 key·순서를 바꾸거나 지우지 말고 끝에만 추가한다** — 순서가
// 바뀌면 지난 날짜의 질문이 다른 질문으로 보이게 된다.
export const DAILY_QUESTIONS = [
  { key: "q001", text: "오늘 하루 중 가장 나를 생각나게 한 순간은 언제였어?" },
  { key: "q002", text: "우리가 다시 만나면 제일 먼저 하고 싶은 건 뭐야?" },
  { key: "q003", text: "요즘 거기서 자주 듣는 노래 하나만 알려줘." },
  { key: "q004", text: "처음 만났을 때 나에 대해 가장 기억에 남는 게 뭐야?" },
  { key: "q005", text: "지금 창밖으로 뭐가 보여?" },
  { key: "q006", text: "떨어져 있어서 좋은 점을 하나만 꼽는다면?" },
  { key: "q007", text: "내가 해준 말 중에 아직도 기억나는 말이 있어?" },
  { key: "q008", text: "이번 주에 제일 힘들었던 일은 뭐였어?" },
  { key: "q009", text: "같이 살게 된다면 꼭 지키고 싶은 우리만의 규칙은?" },
  { key: "q010", text: "오늘 먹은 것 중에 나한테도 먹여주고 싶은 건?" },
  { key: "q011", text: "요즘 나한테 고마웠던 순간이 있다면?" },
  { key: "q012", text: "우리 둘이 같이 가보고 싶은 도시는 어디야?" },
  { key: "q013", text: "보고 싶을 때 주로 뭘 해?" },
  { key: "q014", text: "10년 뒤 우리의 평범한 하루를 상상해본다면?" },
  { key: "q015", text: "내가 모르는 너의 사소한 습관 하나를 알려줘." },
  { key: "q016", text: "지금 이 순간 기분을 날씨로 표현하면?" },
  { key: "q017", text: "우리가 함께 찍은 사진 중에 제일 좋아하는 건?" },
  { key: "q018", text: "요즘 새로 생긴 작은 목표가 있어?" },
  { key: "q019", text: "통화할 때 내 목소리에서 기분을 알아챈 적 있어?" },
  { key: "q020", text: "다음에 만나면 같이 해보고 싶은 새로운 경험은?" },
  { key: "q021", text: "어릴 때 꿈은 뭐였어?" },
  { key: "q022", text: "내가 곁에 있었으면 했던 순간이 이번 주에 있었어?" },
  { key: "q023", text: "우리 관계에서 요즘 제일 자랑스러운 점은?" },
  { key: "q024", text: "거기 동네에서 나를 꼭 데려가고 싶은 곳은?" },
  { key: "q025", text: "서운했는데 말 못 한 게 있다면 지금 살짝 말해줄래?" },
  { key: "q026", text: "요즘 잠들기 전에 무슨 생각을 해?" },
  { key: "q027", text: "나를 한 단어로 표현한다면?" },
  { key: "q028", text: "우리만 아는 농담 중에 제일 좋아하는 건?" },
  { key: "q029", text: "오늘 나한테 해주고 싶은 말 한마디." },
  { key: "q030", text: "우리가 처음 떨어져 지내기 시작한 날, 어떤 기분이었어?" },
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
