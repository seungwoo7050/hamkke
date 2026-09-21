import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60;

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // AWS SDK v3 최신 버전은 기본적으로 요청에 체크섬 헤더를 자동으로 붙이는데,
    // 이 헤더가 presigned URL 서명엔 포함되지만 실제 브라우저의 PUT 요청에는
    // 없어서 SignatureDoesNotMatch가 나는 알려진 이슈가 있다. R2는 이 체크섬
    // 기능을 지원하지 않으므로 비활성화한다.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

// size는 클라이언트가 신고한 바이트 수. 서명에 content-length가 들어가서 실제로
// 다른 크기를 PUT하면 R2가 403을 돌려준다(상한은 src/lib/upload-limits.ts).
export async function createUploadUrl(key: string, contentType: string, size: number) {
  const client = createR2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
  );
}

export async function createDownloadUrl(key: string) {
  const client = createR2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    {
      expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
    },
  );
}

/** 올라간 오브젝트의 크기·형식. 없으면 null(업로드 주소만 받고 안 올린 경우). */
export async function headUpload(key: string) {
  const client = createR2Client();
  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    );
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch (err) {
    if ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/** 없는 키를 지워도 성공(R2가 204)이라 재시도해도 안전하다. */
export async function deleteUpload(key: string) {
  const client = createR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
}

/** 임시 경로의 파일을 정식 경로로 옮긴다(복사 후 임시 파일 삭제). 형식 등 메타데이터는 그대로. */
export async function promoteUpload(pendingKey: string, finalKey: string) {
  const client = createR2Client();
  const Bucket = process.env.R2_BUCKET_NAME;
  await client.send(
    new CopyObjectCommand({ Bucket, Key: finalKey, CopySource: `${Bucket}/${pendingKey}` }),
  );
  await client.send(new DeleteObjectCommand({ Bucket, Key: pendingKey }));
}

/** 접두사 아래 파일을 전부 지운다(목록 1000개씩 받아 일괄 삭제). 지운 개수를 돌려준다. */
export async function deletePrefix(prefix: string) {
  const client = createR2Client();
  const Bucket = process.env.R2_BUCKET_NAME;
  let deleted = 0;
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }),
    );
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) {
      const res = await client.send(
        new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }),
      );
      if (res.Errors?.length) {
        throw new Error(`R2 삭제 실패: ${res.Errors.map((e) => e.Key).join(", ")}`);
      }
      deleted += keys.length;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return deleted;
}
