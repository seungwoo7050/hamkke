-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video');

-- AlterTable
ALTER TABLE "Moment" ADD COLUMN     "mediaKind" "MediaKind" NOT NULL DEFAULT 'image';
