// 정책 문서 주소(/legal/<slug>) 목록. 본문 없이 이름만 - 클라이언트 화면(설정 시트)이
// 링크를 만들 때 본문 전체를 번들에 싣지 않게 따로 둔다.
export const LEGAL_SLUGS = ["privacy", "terms", "location"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
