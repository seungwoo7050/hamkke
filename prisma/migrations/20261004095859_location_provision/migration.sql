-- CreateEnum
CREATE TYPE "LocationProvisionKind" AS ENUM ('live', 'latest', 'derived', 'arrival');

-- CreateTable
CREATE TABLE "LocationProvision" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" "LocationProvisionKind" NOT NULL,
    "hourStart" TIMESTAMP(3) NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LocationProvision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationProvision_subjectId_hourStart_idx" ON "LocationProvision"("subjectId", "hourStart");

-- CreateIndex
CREATE UNIQUE INDEX "LocationProvision_subjectId_recipientId_kind_hourStart_key" ON "LocationProvision"("subjectId", "recipientId", "kind", "hourStart");

-- AddForeignKey
ALTER TABLE "LocationProvision" ADD CONSTRAINT "LocationProvision_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationProvision" ADD CONSTRAINT "LocationProvision_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 앱 테이블은 모두 RLS를 켠다(lock_down_public_tables, src/server/db-security.test.ts).
ALTER TABLE "LocationProvision" ENABLE ROW LEVEL SECURITY;
