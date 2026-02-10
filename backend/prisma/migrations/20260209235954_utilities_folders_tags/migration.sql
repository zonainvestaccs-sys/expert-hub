/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UtilityLinkTag` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UtilityFolder_name_key";

-- DropIndex
DROP INDEX "UtilityFolder_orderIndex_idx";

-- DropIndex
DROP INDEX "UtilityLink_createdAt_idx";

-- DropIndex
DROP INDEX "UtilityLink_orderIndex_idx";

-- DropIndex
DROP INDEX "UtilityTag_name_idx";

-- AlterTable
ALTER TABLE "UtilityFolder" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "UtilityLinkTag" DROP COLUMN "createdAt";

-- CreateIndex
CREATE INDEX "UtilityFolder_parentId_orderIndex_idx" ON "UtilityFolder"("parentId", "orderIndex");

-- CreateIndex
CREATE INDEX "UtilityFolder_parentId_name_idx" ON "UtilityFolder"("parentId", "name");

-- AddForeignKey
ALTER TABLE "UtilityFolder" ADD CONSTRAINT "UtilityFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "UtilityFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
