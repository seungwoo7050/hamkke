// 탑승권 바코드(IATA BCBP, Resolution 792) 해석 - PRD §3.3.1. 종이·모바일
// 탑승권의 PDF417/Aztec/QR에 같은 고정 폭 문자열이 들어 있다. 여기서 쓰는 건
// 편명·출발/도착 공항·출발 날짜뿐이고, 이름·예약번호·좌석은 읽지 않고
// 버린다(저장하지 않음). 바코드엔 시각이 없어 시각은 사람이 채운다.

export type BoardingPassLeg = {
  flightNumber: string;
  fromIata: string;
  toIata: string;
  /** 출발 공항 현지 날짜 "YYYY-MM-DD" */
  departureDate: string;
};

// 필수 항목 고정 위치(0부터): 30–32 출발, 33–35 도착, 36–38 운항 항공사,
// 39–43 편 번호, 44–46 출발일(그해의 몇 번째 날). 첫 구간만 쓴다.
export function parseBoardingPass(raw: string, today: Date = new Date()): BoardingPassLeg | null {
  const s = raw.replace(/\r?\n/g, "");
  if (s.length < 47 || s[0] !== "M") return null;
  const fromIata = s.slice(30, 33).trim().toUpperCase();
  const toIata = s.slice(33, 36).trim().toUpperCase();
  const carrier = s.slice(36, 39).trim().toUpperCase();
  const number = s.slice(39, 44).trim().toUpperCase();
  const dayOfYear = Number(s.slice(44, 47));
  if (!/^[A-Z]{3}$/.test(fromIata) || !/^[A-Z]{3}$/.test(toIata)) return null;
  if (!/^[A-Z0-9]{2}$/.test(carrier)) return null;
  const m = /^0*(\d{1,4})([A-Z]?)$/.exec(number);
  if (!m || !(dayOfYear >= 1 && dayOfYear <= 366)) return null;

  return {
    flightNumber: `${carrier}${m[1].padStart(3, "0")}${m[2]}`,
    fromIata,
    toIata,
    departureDate: resolveDayOfYear(dayOfYear, today),
  };
}

// 바코드엔 연도가 없다 - 탑승권은 보통 출발 며칠 전~당일에 받으므로, 오늘
// 기준 한 달 전보다 이르면 내년으로 본다(12월에 1월 탑승권을 받는 경우).
function resolveDayOfYear(dayOfYear: number, today: Date) {
  const monthAgo = today.getTime() - 30 * 86_400_000;
  for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    const date = new Date(Date.UTC(year, 0, dayOfYear));
    if (date.getTime() >= monthAgo) return date.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(today.getUTCFullYear() + 1, 0, dayOfYear)).toISOString().slice(0, 10);
}
