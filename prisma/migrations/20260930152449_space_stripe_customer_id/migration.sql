-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Space_stripeCustomerId_key" ON "Space"("stripeCustomerId");
