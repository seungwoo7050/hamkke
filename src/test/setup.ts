// Vitest는 Next.js와 달리 .env를 자동으로 읽지 않는다 — Prisma가 DATABASE_URL을
// 읽기 전에 직접 로드해줘야 한다.
import "dotenv/config";
