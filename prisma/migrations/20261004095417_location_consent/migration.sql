-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locationConsentAt" TIMESTAMP(3);

-- 이 컬럼이 생기기 전에 켜 둔 위치 공유는 약관 동의를 받은 적이 없다. 끄고(동의 철회와
-- 같은 상태) 받아 둔 좌표를 지운다 - 다시 켜면 동의 화면을 거친다.
UPDATE "User" SET "locationSharingEnabled" = false WHERE "locationSharingEnabled";
DELETE FROM "LocationPing";
