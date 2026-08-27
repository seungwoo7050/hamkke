-- CreateTable
CREATE TABLE "Touch" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Touch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Touch_spaceId_createdAt_idx" ON "Touch"("spaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Touch" ADD CONSTRAINT "Touch_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touch" ADD CONSTRAINT "Touch_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
