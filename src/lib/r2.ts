import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
