import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// connection()은 Next.js 요청 안에서만 의미가 있다 - 여기선 그대로 통과시킨다.
vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET } = await import("./route");

describe("GET /api/health", () => {
  afterEach(() => vi.restoreAllMocks());

  it("DB에 닿으면 200과 ok만 돌려준다", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("DB에 닿지 않으면 503이고, 오류 내용은 싣지 않는다", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValue(
      new Error("Can't reach database server at db.internal:5432"),
    );
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });
});
