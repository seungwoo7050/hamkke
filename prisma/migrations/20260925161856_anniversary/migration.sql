-- CreateTable
CREATE TABLE "Anniversary" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anniversary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anniversary_spaceId_idx" ON "Anniversary"("spaceId");

-- AddForeignKey
ALTER TABLE "Anniversary" ADD CONSTRAINT "Anniversary_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
