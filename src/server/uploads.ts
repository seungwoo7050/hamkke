import "server-only";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { headUpload } from "@/lib/r2";

type Folder = "messages" | "moments";

// 업로드는 먼저 임시 경로(pending/)에 올리고, 등록할 때 정식 경로로 옮긴다. 주소만
// 받고 등록하지 않은 파일은 R2 수명 주기 규칙(pending/ 1일 뒤 삭제 — README 배포
// 체크리스트)이 지운다. 스케줄러 없이 고아 파일이 쌓이지 않게 하는 방법이다.
export const PENDING_PREFIX = "pending/";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** 업로드 주소를 발급할 임시 키. 서버만 만든다. */
export function newUploadKey(folder: Folder, spaceId: string) {
  return `${PENDING_PREFIX}${folder}/${spaceId}/${randomUUID()}`;
}

// 등록할 때 키 모양과 자기 스페이스인지, 실제로 올라왔는지, 올라온 형식이 허용
// 목록인지 확인한다 — 남의 스페이스 파일을 가리키거나(다운로드 주소 발급), 업로드
// 없이 행만 만들거나, 서명에 안 묶인 Content-Type을 바꿔 올린 경우를 막는다.
// 옮겨 갈 정식 키(finalKey)를 함께 돌려준다.
export async function verifyUpload(
  key: string,
  expected: {
    folder: Folder;
    spaceId: string;
    allowedTypes: readonly string[];
    locale?: string | null;
  },
) {
  const t = translator(expected.locale);
  const pattern = new RegExp(`^${PENDING_PREFIX}${expected.folder}/${expected.spaceId}/${UUID}$`);
  if (!pattern.test(key)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.uploadNotFound") });
  }

  const head = await headUpload(key);
  if (!head || !expected.allowedTypes.includes(head.contentType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.uploadNotFound") });
  }
  return { size: head.size, finalKey: key.slice(PENDING_PREFIX.length) };
}
