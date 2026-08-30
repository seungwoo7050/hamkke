-- CreateTable
CREATE TABLE "MeetupPin" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetupPin_spaceId_date_idx" ON "MeetupPin"("spaceId", "date");

-- AddForeignKey
ALTER TABLE "MeetupPin" ADD CONSTRAINT "MeetupPin_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
