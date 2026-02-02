-- DropIndex
DROP INDEX "LeadTag_expertId_tagId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activationsSheetCsvUrl" TEXT,
ADD COLUMN     "activationsSheetGid" TEXT,
ADD COLUMN     "activationsSheetId" TEXT,
ADD COLUMN     "activationsSheetTab" TEXT;

-- CreateIndex
CREATE INDEX "LeadTag_tagId_idx" ON "LeadTag"("tagId");
