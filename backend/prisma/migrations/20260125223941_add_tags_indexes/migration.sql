-- DropIndex
DROP INDEX "LeadTag_tagId_idx";

-- CreateIndex
CREATE INDEX "LeadTag_expertId_tagId_idx" ON "LeadTag"("expertId", "tagId");
