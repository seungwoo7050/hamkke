// 가짜 언어(pseudo-locale) - 개발 전용 품질 도구(ARCHITECTURE.md §12). 영어 문구를
// "[Ŧĥîñķîñĝ ōf ÿōū~~]"처럼 길고 이상한 글자로 바꿔, (1) 문구 파일을 거치지 않은
// 하드코딩 문장(바뀌지 않고 그대로 보임)과 (2) 긴 번역에서 잘리는 레이아웃을 한눈에
// 드러낸다. ICU 문법({name}, {count, plural, …})은 그대로 둔다.

const MAP: Record<string, string> = {
  a: "ā",
  b: "ƀ",
  c: "ç",
  d: "đ",
  e: "ē",
  f: "ƒ",
  g: "ĝ",
  h: "ĥ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ļ",
  m: "ɱ",
  n: "ñ",
  o: "ō",
  p: "þ",
  r: "ŕ",
  s: "š",
  t: "ŧ",
  u: "ū",
  w: "ŵ",
  y: "ÿ",
  z: "ž",
  A: "Ā",
  B: "Ɓ",
  C: "Ç",
  D: "Đ",
  E: "Ē",
  G: "Ĝ",
  H: "Ĥ",
  I: "Î",
  J: "Ĵ",
  K: "Ķ",
  L: "Ļ",
  N: "Ñ",
  O: "Ō",
  R: "Ŕ",
  S: "Š",
  T: "Ŧ",
  U: "Ū",
  W: "Ŵ",
  Y: "Ÿ",
  Z: "Ž",
};

/** ICU 변수와 서식 태그(<terms>…</terms>의 태그 이름) 바깥 글자만 바꾸고, 약 40% 길게 늘린다. */
export function pseudoString(message: string): string {
  let out = "";
  let depth = 0;
  let inTag = false;
  let letters = 0;
  for (const ch of message) {
    if (ch === "{") depth++;
    if (ch === "<") inTag = true;
    if (depth === 0 && !inTag) {
      out += MAP[ch] ?? ch;
      if (/[a-z]/i.test(ch)) letters++;
    } else {
      out += ch;
    }
    if (ch === "}") depth--;
    if (ch === ">") inTag = false;
  }
  return `[${out}${"~".repeat(Math.ceil(letters * 0.4))}]`;
}

export function pseudoMessages<T>(messages: T): T {
  if (typeof messages === "string") return pseudoString(messages) as T;
  return Object.fromEntries(
    Object.entries(messages as Record<string, unknown>).map(([k, v]) => [k, pseudoMessages(v)]),
  ) as T;
}

/** 이 쿠키가 있으면(개발 서버에서만) 화면을 가짜 언어로 그린다. */
export const PSEUDO_COOKIE = "hamkke-pseudo";
