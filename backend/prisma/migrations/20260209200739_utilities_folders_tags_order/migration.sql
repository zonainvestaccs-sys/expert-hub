-- AlterTable
ALTER TABLE "UtilityLink" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UtilityFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityLinkTag" (
    "utilityId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityLinkTag_pkey" PRIMARY KEY ("utilityId","tagId")
);

-- CreateIndex
CREATE INDEX "UtilityFolder_orderIndex_idx" ON "UtilityFolder"("orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityFolder_name_key" ON "UtilityFolder"("name");

-- CreateIndex
CREATE INDEX "UtilityTag_name_idx" ON "UtilityTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityTag_name_key" ON "UtilityTag"("name");

-- CreateIndex
CREATE INDEX "UtilityLinkTag_tagId_idx" ON "UtilityLinkTag"("tagId");

-- CreateIndex
CREATE INDEX "UtilityLink_orderIndex_idx" ON "UtilityLink"("orderIndex");

-- CreateIndex
CREATE INDEX "UtilityLink_folderId_orderIndex_idx" ON "UtilityLink"("folderId", "orderIndex");

-- AddForeignKey
ALTER TABLE "UtilityLinkTag" ADD CONSTRAINT "UtilityLinkTag_utilityId_fkey" FOREIGN KEY ("utilityId") REFERENCES "UtilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityLinkTag" ADD CONSTRAINT "UtilityLinkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "UtilityTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityLink" ADD CONSTRAINT "UtilityLink_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "UtilityFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
