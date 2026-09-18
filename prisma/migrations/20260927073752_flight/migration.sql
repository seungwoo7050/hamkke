-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('scheduled', 'departed', 'landed', 'cancelled');

-- CreateEnum
CREATE TYPE "FlightSource" AS ENUM ('manual', 'barcode', 'api');

-- AlterTable
ALTER TABLE "Capsule" ADD COLUMN     "flightId" TEXT;

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "fromIata" TEXT NOT NULL,
    "toIata" TEXT NOT NULL,
    "scheduledDepartureAt" TIMESTAMP(3) NOT NULL,
    "scheduledArrivalAt" TIMESTAMP(3) NOT NULL,
    "actualDepartureAt" TIMESTAMP(3),
    "actualArrivalAt" TIMESTAMP(3),
    "status" "FlightStatus" NOT NULL DEFAULT 'scheduled',
    "source" "FlightSource" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flight_spaceId_scheduledDepartureAt_idx" ON "Flight"("spaceId", "scheduledDepartureAt");

-- AddForeignKey
ALTER TABLE "Capsule" ADD CONSTRAINT "Capsule_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
