// 이름 뒤 조사를 받침 유무로 고른다("지우가"/"민준이가" 대신 "민준이"). 상대
// 이름은 사용자가 정하므로 화면 문구에 고정 조사를 붙이면 절반은 틀린다.
// 한글이 아닌 글자로 끝나면 받침을 알 수 없어 받침 없는 쪽을 쓴다.
const PAIRS = {
  "이/가": ["이", "가"],
  "은/는": ["은", "는"],
  "을/를": ["을", "를"],
  "과/와": ["과", "와"],
} as const;

export function hasFinalConsonant(word: string) {
  const code = word.trim().charCodeAt(word.trim().length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function josa(word: string, pair: keyof typeof PAIRS) {
  const [withFinal, withoutFinal] = PAIRS[pair];
  return `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;
}
