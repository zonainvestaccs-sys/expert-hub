-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expertId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expertId" TEXT NOT NULL,
    "leadKey" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tag_expertId_idx" ON "Tag"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_expertId_name_key" ON "Tag"("expertId", "name");

-- CreateIndex
CREATE INDEX "LeadTag_expertId_leadKey_idx" ON "LeadTag"("expertId", "leadKey");

-- CreateIndex
CREATE INDEX "LeadTag_tagId_idx" ON "LeadTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadTag_expertId_leadKey_tagId_key" ON "LeadTag"("expertId", "leadKey", "tagId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
