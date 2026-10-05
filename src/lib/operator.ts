// 서비스 운영자 정보 - 개인정보처리방침·이용약관·위치기반서비스 이용약관이 함께 쓴다
// (src/legal). 출시 전에 사용자가 채운다(docs COMMIT_PLAN "Android·웹 출시"). 비어 있는
// 값은 문서에 "출시 전 입력"으로 보인다 - 빈칸이 조용히 나가지 않게.
export const OPERATOR = {
  /** 상호(개인사업자면 사업자등록증의 상호) */
  name: "",
  /** 대표자 = 개인정보 보호책임자·위치정보관리책임자 */
  representative: "",
  /** 사업장 주소 */
  address: "",
  /** 문의 이메일 */
  email: "",
  /** 사업자등록번호 */
  businessNumber: "",
  /** Sentry 데이터 저장 지역 - 계정을 만들 때 고른 것. "us"(미국) 또는 "de"(독일, EU) */
  sentryRegion: "us" as "" | "us" | "de",
  /** 문서 시행일(YYYY-MM-DD) */
  effectiveDate: "",
};

export type Operator = typeof OPERATOR;
