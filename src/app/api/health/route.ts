import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// 외부 가용성 모니터가 보는 주소. 서버가 요청을 받고 DB에 닿는지만 본다 - 외부
// 서비스(Stripe·R2·FCM 등)는 부르지 않는다(그쪽 장애로 앱 전체를 "다운"으로 보지
// 않게, 모니터가 남의 API를 두드리지 않게). 응답에 버전·오류 내용 같은 내부 정보는
// 싣지 않는다.
export async function GET() {
  await connection(); // 빌드 때 미리 그리지 않고 요청마다 확인한다.
  const headers = { "Cache-Control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
