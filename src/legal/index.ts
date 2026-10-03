import { OPERATOR } from "@/lib/operator";
import locationEn from "./location.en";
import locationKo from "./location.ko";
import privacyEn from "./privacy.en";
import privacyKo from "./privacy.ko";
import termsEn from "./terms.en";
import termsKo from "./terms.ko";
import { type LegalSlug, LEGAL_SLUGS } from "./slugs";
import type { LegalDoc, LegalDocFactory } from "./types";

export { LEGAL_SLUGS, type LegalSlug };

// 공개 정책 문서 세 편. 주소는 /legal/<slug> - Play Console(개인정보처리방침 URL)과
// 앱 안 링크가 이 주소를 쓴다. 영어판이 없는 언어는 한국어(기준본)를 보여 준다.
const DOCS = {
  privacy: { ko: privacyKo, en: privacyEn },
  terms: { ko: termsKo, en: termsEn },
  location: { ko: locationKo, en: locationEn },
} satisfies Record<LegalSlug, Record<"ko" | "en", LegalDocFactory>>;

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function legalDoc(slug: LegalSlug, locale: string, missing: string): LegalDoc {
  const byLocale: Record<string, LegalDocFactory> = DOCS[slug];
  return (byLocale[locale] ?? DOCS[slug].ko)(OPERATOR, missing);
}
