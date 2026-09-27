import "server-only";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import type { Db } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
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

/**
 * 첨부 등록을 스페이스 단위로 줄 세운다. 한도(사진 수·저장 용량)를 확인하고 행을
 * 만드는 사이에 다른 등록이 끼면 모두 같은 수를 보고 통과하고(29장에서 동시에 5장 →
 * 34장), 같은 임시 키를 동시에 등록하면 모두 임시 파일을 본 뒤 옮겨 한 파일을 가리키는
 * 행이 여럿 생긴다. 안의 확인과 생성은 넘겨받은 tx로 해야 잠금 아래에서 일어난다.
 * 결제 시작(billing.createCheckoutSession)과 같은 방식이다.
 */
export function withUploadRegistrationLock<T>(spaceId: string, fn: (tx: Db) => Promise<T>) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`uploads:${spaceId}`}))`;
      return fn(tx);
    },
    // 잠금을 쥔 채 R2를 두세 번 부르므로(확인·복사·삭제) 기본 5초보다 넉넉하게.
    { timeout: 20_000, maxWait: 20_000 },
  );
}
