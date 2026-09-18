-- CreateTable
CREATE TABLE "InviteCodeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCodeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InviteCodeAttempt_userId_createdAt_idx" ON "InviteCodeAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteCodeAttempt_ip_createdAt_idx" ON "InviteCodeAttempt"("ip", "createdAt");

-- AddForeignKey
ALTER TABLE "InviteCodeAttempt" ADD CONSTRAINT "InviteCodeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
