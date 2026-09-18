// 이름 뒤 조사를 받침 유무로 고른다("지우가"/"민준이가" 대신 "민준이"). 상대
// 이름은 사용자가 정하므로 화면 문구에 고정 조사를 붙이면 절반은 틀린다.
// 숫자로 끝나면 한국어 읽기(영·일·삼·육·칠·팔은 받침)로 판단한다 — 편명
// "KE081이", "KE082가". 그 밖의 한글이 아닌 글자는 받침 없는 쪽을 쓴다.
const PAIRS = {
  "이/가": ["이", "가"],
  "은/는": ["은", "는"],
  "을/를": ["을", "를"],
  "과/와": ["과", "와"],
} as const;

const DIGITS_WITH_FINAL = new Set(["0", "1", "3", "6", "7", "8"]);

export function hasFinalConsonant(word: string) {
  const last = word.trim().slice(-1);
  if (/[0-9]/.test(last)) return DIGITS_WITH_FINAL.has(last);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function josa(word: string, pair: keyof typeof PAIRS) {
  const [withFinal, withoutFinal] = PAIRS[pair];
  return `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;
}
