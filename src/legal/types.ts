import type { Operator } from "@/lib/operator";

// 정책 문서 한 편. 본문은 화면 코드가 아니라 콘텐츠라 언어별 파일(src/legal/*.ko.ts,
// *.en.ts)에 두고, 페이지(src/app/legal/[doc]/page.tsx)는 이 구조를 그리기만 한다.
export type LegalBlock =
  string | { list: string[] } | { table: { head: string[]; rows: string[][] } };

export type LegalDoc = {
  title: string;
  intro: string;
  sections: { heading: string; blocks: LegalBlock[] }[];
};

/** 운영자 정보 칸 - 비어 있으면 placeholder를 보여 출시 전에 채우게 한다. */
export type LegalDocFactory = (op: Operator, missing: string) => LegalDoc;

export function field(value: string, missing: string) {
  return value.trim() || missing;
}
