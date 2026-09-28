/**
 * 브라우저가 R2에 직접 PUT할 수 있는지(버킷 CORS 규칙) 확인한다
 * (README 배포 체크리스트 6번 - 대시보드에서 CORS 규칙을 넣은 뒤).
 *
 * 실행: npx tsx --conditions=react-server scripts/check-r2-cors.mts [오리진...]
 *   기본 오리진은 http://localhost:3000. 운영 도메인도 함께 확인한다:
 *   npx tsx --conditions=react-server scripts/check-r2-cors.mts http://localhost:3000 https://<도메인>
 *   (.env의 R2_* 사용)
 *
 * 앱과 똑같이 서명한 업로드 주소에 preflight(OPTIONS)만 보내고 실제로 PUT하지는
 * 않으므로 버킷에 아무것도 생기지 않는다. 앱의 R2 키는 버킷 설정을 읽을 권한이
 * 없어서(GetBucketCors는 AccessDenied) 규칙 자체 대신 브라우저가 받을 응답을 본다.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createUploadUrl } from "../src/lib/r2";

const origins = process.argv.slice(2);
if (origins.length === 0) origins.push("http://localhost:3000");

const uploadUrl = await createUploadUrl(`pending/cors-check/${randomUUID()}`, "image/png", 1);

let failed = false;
for (const origin of origins) {
  const res = await fetch(uploadUrl, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allowOrigin = res.headers.get("access-control-allow-origin");
  const ok = res.ok && (allowOrigin === origin || allowOrigin === "*");
  if (!ok) failed = true;
  console.log(
    `${ok ? "통과" : "실패"}  ${origin}  (preflight ${res.status}, allow-origin: ${allowOrigin ?? "없음"})`,
  );
}

console.log(failed ? "\nCORS 규칙을 확인하세요(README 배포 체크리스트 6번)." : "\n전부 통과");
process.exit(failed ? 1 : 0);
