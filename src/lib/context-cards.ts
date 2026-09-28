// "우리" 탭 상황 카드 선택(DESIGN.md §4). 주변부는 조용해야 하므로 해당하는
// 것이 여러 개여도 우선순위대로 최대 2장만 보여준다. "곧 만나요"는 카드가
// 아니라 장면 전체가 바뀌는 최우선 상태라 여기서 다루지 않는다(us-scene).
// 하루 한 질문 카드는 도착한 캡슐 다음, D-day 앞에 들어간다. 첫날 안내(다음
// 만남 정하기 > 기념일 적기)는 맨 뒤. 비행(PRD §3.3.1)은 시각이 중요한 순간이라
// 비행 중·막 도착은 맨 앞, 곧 출발은 도착한 캡슐 다음.

export const MAX_CONTEXT_CARDS = 2;

export type FlightCardKind = "flight-inflight" | "flight-arrived" | "flight-departing";

export type ContextCard =
  | { kind: FlightCardKind; flightId: string }
  | { kind: "anniversary"; title: string }
  | { kind: "capsule"; count: number }
  | { kind: "question"; partnerAnswered: boolean }
  | { kind: "countdown"; title: string; days: number }
  | { kind: "setup-anniversary" }
  | { kind: "setup-meetup" };

export type ContextInputs = {
  /** 오늘(로컬 기준 D-0)인 기념일 제목들 */
  todayAnniversaries: string[];
  /** 최근 도착해 아직 새로운, 상대가 보낸 캡슐 수 */
  arrivedCapsules: number;
  /** 오늘의 질문에 내가 아직 답하지 않았으면 채운다 */
  pendingQuestion: { partnerAnswered: boolean } | null;
  /** 지금 다룰 항공편(src/lib/flight.ts pickFlight) */
  flight?: { kind: FlightCardKind; flightId: string } | null;
  /** 가장 가까운 앞으로의 카운트다운 */
  nextCountdown: { title: string; days: number } | null;
  /**
   * 첫날 안내 - 기념일/다음 만남이 하나도 없을 때(가입 직후). 아무것도 없는
   * 빈 홈 대신 처음 할 일을 가장 낮은 우선순위로 제안한다(PRD §6 온보딩 5단계).
   */
  setup?: { needsAnniversary: boolean; needsMeetupDate: boolean };
};

export function selectContextCards(input: ContextInputs): ContextCard[] {
  const cards: ContextCard[] = [];
  const flight = input.flight;
  if (flight && flight.kind !== "flight-departing") cards.push(flight);
  for (const title of input.todayAnniversaries) cards.push({ kind: "anniversary", title });
  if (input.arrivedCapsules > 0) cards.push({ kind: "capsule", count: input.arrivedCapsules });
  if (flight?.kind === "flight-departing") cards.push(flight);
  if (input.pendingQuestion) cards.push({ kind: "question", ...input.pendingQuestion });
  if (input.nextCountdown) cards.push({ kind: "countdown", ...input.nextCountdown });
  if (input.setup?.needsMeetupDate) cards.push({ kind: "setup-meetup" });
  if (input.setup?.needsAnniversary) cards.push({ kind: "setup-anniversary" });
  return cards.slice(0, MAX_CONTEXT_CARDS);
}
