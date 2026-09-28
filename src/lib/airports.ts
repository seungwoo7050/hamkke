import "server-only";
import data from "@/data/airports.json";

// 공항 좌표·시간대(PRD §3.3.1 비행). 데이터는 scripts/build-airports.mts가
// mwgg/Airports(MIT)에서 만든 번들 - 런타임 네트워크·API 키가 없다. 7,900여 곳
// 이라 클라이언트로 보내지 않고 서버에서 조회·검색만 한다.

export type Airport = {
  iata: string;
  /** 짧은 도시 이름 - 장면·카드의 "인천 → 뉴욕" */
  city: string;
  /** 목록·검색 결과용 전체 이름 */
  name: string;
  country: string;
  lat: number;
  lng: number;
  timeZone: string;
};

// 한국어 화면에서만 자주 오가는 공항에 한국어 이름을 붙인다(나머지는 원문
// 도시명). 다른 언어는 데이터의 영어 원문 그대로 - 새 언어에 현지 이름이
// 필요하면 이런 표를 언어별로 하나 더 둔다(PRD §3.8).
// [짧은 도시, 전체 이름]
const KO: Record<string, [string, string]> = {
  ICN: ["인천", "인천국제공항"],
  GMP: ["김포", "김포국제공항"],
  PUS: ["부산", "김해국제공항"],
  CJU: ["제주", "제주국제공항"],
  TAE: ["대구", "대구국제공항"],
  CJJ: ["청주", "청주국제공항"],
  NRT: ["도쿄", "도쿄 나리타"],
  HND: ["도쿄", "도쿄 하네다"],
  KIX: ["오사카", "오사카 간사이"],
  ITM: ["오사카", "오사카 이타미"],
  NGO: ["나고야", "나고야 주부"],
  FUK: ["후쿠오카", "후쿠오카"],
  CTS: ["삿포로", "삿포로 신치토세"],
  OKA: ["오키나와", "오키나와 나하"],
  PEK: ["베이징", "베이징 서우두"],
  PKX: ["베이징", "베이징 다싱"],
  PVG: ["상하이", "상하이 푸둥"],
  SHA: ["상하이", "상하이 훙차오"],
  CAN: ["광저우", "광저우 바이윈"],
  SZX: ["선전", "선전 바오안"],
  HKG: ["홍콩", "홍콩국제공항"],
  MFM: ["마카오", "마카오국제공항"],
  TPE: ["타이베이", "타이베이 타오위안"],
  TSA: ["타이베이", "타이베이 쑹산"],
  BKK: ["방콕", "방콕 수완나품"],
  DMK: ["방콕", "방콕 돈므앙"],
  SIN: ["싱가포르", "싱가포르 창이"],
  KUL: ["쿠알라룸푸르", "쿠알라룸푸르국제공항"],
  SGN: ["호찌민", "호찌민 떤선녓"],
  HAN: ["하노이", "하노이 노이바이"],
  DAD: ["다낭", "다낭국제공항"],
  MNL: ["마닐라", "마닐라 니노이아키노"],
  CEB: ["세부", "세부 막탄"],
  CGK: ["자카르타", "자카르타 수카르노하타"],
  DPS: ["발리", "발리 응우라라이"],
  JFK: ["뉴욕", "뉴욕 JFK"],
  EWR: ["뉴욕", "뉴욕 뉴어크"],
  LGA: ["뉴욕", "뉴욕 라과디아"],
  LAX: ["로스앤젤레스", "로스앤젤레스국제공항"],
  SFO: ["샌프란시스코", "샌프란시스코국제공항"],
  SJC: ["산호세", "산호세국제공항"],
  SEA: ["시애틀", "시애틀 타코마"],
  ORD: ["시카고", "시카고 오헤어"],
  IAD: ["워싱턴", "워싱턴 덜레스"],
  BOS: ["보스턴", "보스턴 로건"],
  ATL: ["애틀랜타", "애틀랜타 하츠필드잭슨"],
  DFW: ["댈러스", "댈러스 포트워스"],
  IAH: ["휴스턴", "휴스턴 조지부시"],
  LAS: ["라스베이거스", "라스베이거스 해리리드"],
  HNL: ["호놀룰루", "호놀룰루 대니얼K이노우에"],
  YVR: ["밴쿠버", "밴쿠버국제공항"],
  YYZ: ["토론토", "토론토 피어슨"],
  LHR: ["런던", "런던 히스로"],
  LGW: ["런던", "런던 개트윅"],
  CDG: ["파리", "파리 샤를드골"],
  FRA: ["프랑크푸르트", "프랑크푸르트국제공항"],
  MUC: ["뮌헨", "뮌헨국제공항"],
  AMS: ["암스테르담", "암스테르담 스히폴"],
  FCO: ["로마", "로마 피우미치노"],
  MXP: ["밀라노", "밀라노 말펜사"],
  MAD: ["마드리드", "마드리드 바라하스"],
  BCN: ["바르셀로나", "바르셀로나 엘프라트"],
  IST: ["이스탄불", "이스탄불국제공항"],
  ZRH: ["취리히", "취리히국제공항"],
  VIE: ["빈", "빈국제공항"],
  PRG: ["프라하", "프라하 바츨라프하벨"],
  HEL: ["헬싱키", "헬싱키 반타"],
  SYD: ["시드니", "시드니 킹스퍼드스미스"],
  MEL: ["멜버른", "멜버른 툴라마린"],
  BNE: ["브리즈번", "브리즈번국제공항"],
  AKL: ["오클랜드", "오클랜드국제공항"],
  DXB: ["두바이", "두바이국제공항"],
  DOH: ["도하", "도하 하마드"],
};

type Row = [string, string, string, string, number, number, string];

type Row0 = Omit<Airport, "city" | "name"> & { city: string; name: string };
const byIata = new Map<string, Row0>();
// 한국어 이름을 붙여도 영어 원문으로 검색되도록 검색어 텍스트를 따로 둔다.
const searchText = new Map<string, string>();
for (const [iata, city, name, country, lat, lng, timeZone] of data.rows as Row[]) {
  const ko = KO[iata];
  searchText.set(iata, [ko?.[0], ko?.[1], city, name].filter(Boolean).join("\n").toLowerCase());
  byIata.set(iata, { iata, city, name, country, lat, lng, timeZone });
}

/** 그 언어로 보여줄 공항 - 한국어면 한국어 이름을 덧씌운다. */
function localized(a: Row0, locale: string): Airport {
  const ko = locale === "ko" ? KO[a.iata] : undefined;
  return ko ? { ...a, city: ko[0], name: ko[1] } : a;
}

export function getAirport(iata: string, locale = "ko"): Airport | null {
  const a = byIata.get(iata.trim().toUpperCase());
  return a ? localized(a, locale) : null;
}

/**
 * 등록 시트의 공항 검색. IATA 코드가 정확히 맞으면 맨 앞, 그다음 한국어 이름이
 * 붙은 주요 공항, 그다음 도시·이름이 검색어로 시작하는 곳, 포함하는 곳 순.
 */
export function searchAirports(query: string, limit = 8, locale = "ko"): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { a: Row0; score: number }[] = [];
  for (const a of byIata.values()) {
    const text = searchText.get(a.iata)!;
    let score = -1;
    if (a.iata.toLowerCase() === q) score = 100;
    else if (text.split("\n").some((t) => t.startsWith(q))) score = 50;
    else if (text.includes(q)) score = 20;
    else if (q.length >= 2 && a.iata.toLowerCase().startsWith(q)) score = 10;
    if (score < 0) continue;
    if (KO[a.iata]) score += 30;
    scored.push({ a, score });
  }
  return scored
    .sort((x, y) => y.score - x.score || x.a.iata.localeCompare(y.a.iata))
    .slice(0, limit)
    .map((x) => localized(x.a, locale));
}
