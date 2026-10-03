-- CreateTable
CREATE TABLE "PlayExternalTransaction" (
    "id" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "initialTransactionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "preTaxAmount" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayExternalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayExternalTransaction_stripeSubscriptionId_idx" ON "PlayExternalTransaction"("stripeSubscriptionId");

-- 앱 테이블은 모두 RLS를 켠다(lock_down_public_tables, src/server/db-security.test.ts).
ALTER TABLE "PlayExternalTransaction" ENABLE ROW LEVEL SECURITY;
