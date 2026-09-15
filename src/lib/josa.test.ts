import { describe, expect, it } from "vitest";
import { josa } from "./josa";

describe("josa", () => {
  it("받침 유무에 맞는 조사를 붙인다", () => {
    expect(josa("지우", "이/가")).toBe("지우가");
    expect(josa("민준", "이/가")).toBe("민준이");
    expect(josa("민준", "과/와")).toBe("민준과");
    expect(josa("지우", "은/는")).toBe("지우는");
  });

  it("한글이 아닌 이름은 받침 없는 쪽을 쓴다", () => {
    expect(josa("Alex", "이/가")).toBe("Alex가");
    expect(josa("개발용-B", "이/가")).toBe("개발용-B가");
  });
});

describe("숫자로 끝나는 말(편명)", () => {
  it("한국어 읽기로 받침을 판단한다", () => {
    expect(josa("KE081", "이/가")).toBe("KE081이");
    expect(josa("KE082", "이/가")).toBe("KE082가");
    expect(josa("OZ220", "이/가")).toBe("OZ220이");
  });
});
