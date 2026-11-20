import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Vercel 서버리스 인스턴스가 여럿 떠도 Supabase Free Session pooler(5432)의
// 동시 클라이언트 한도를 넘지 않도록 인스턴스당 풀 상한을 제한한다.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
