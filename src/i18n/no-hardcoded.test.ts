import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 하드코딩 문구 게이트(ARCHITECTURE.md §12): 화면 코드(src/app, src/components)에
// 한국어 문장이 문구 파일을 거치지 않고 남아 있으면 실패한다. 주석과, 화면에 나가지
// 않는 내부 에러(new Error)는 뺀다. 한국어 표기를 직접 조립하는 부품(src/i18n,
// src/lib의 한국어 포맷터)은 대상이 아니다.
const ROOTS = ["src/app", "src/components"];
const HANGUL = /[가-힣]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

function stripComments(source: string) {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // JSX 주석
    .replace(/\/\*[\s\S]*?\*\//g, "") // 블록 주석
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1"); // 줄 주석(URL의 // 는 제외)
}

describe("하드코딩 문구", () => {
  it("화면 코드에 한국어 문장이 남아 있지 않다", () => {
    const offenders = ROOTS.flatMap(files).flatMap((file) =>
      stripComments(readFileSync(file, "utf8"))
        .split("\n")
        .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
        .filter(({ text }) => HANGUL.test(text) && !/new Error\(/.test(text)),
    );
    expect(offenders.map((o) => `${o.file}:${o.line} ${o.text}`)).toEqual([]);
  });
});
