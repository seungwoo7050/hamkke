import "server-only";
import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { headUpload } from "@/lib/r2";

// 업로드 키는 서버가 `${folder}/${spaceId}/${uuid}`로만 만든다. 등록할 때 이 모양과
// 자기 스페이스인지, 실제로 올라왔는지, 올라온 형식이 허용 목록인지 확인한다 —
// 남의 스페이스 파일을 가리키거나(다운로드 주소 발급), 업로드 없이 행만 만들거나,
// 서명에 안 묶인 Content-Type을 바꿔 올린 경우를 막는다.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export async function verifyUpload(
  key: string,
  expected: {
    folder: "messages" | "moments";
    spaceId: string;
    allowedTypes: readonly string[];
    locale?: string | null;
  },
) {
  const t = translator(expected.locale);
  const pattern = new RegExp(`^${expected.folder}/${expected.spaceId}/${UUID}$`);
  if (!pattern.test(key)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.uploadNotFound") });
  }

  const head = await headUpload(key);
  if (!head || !expected.allowedTypes.includes(head.contentType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.uploadNotFound") });
  }
  return head;
}
