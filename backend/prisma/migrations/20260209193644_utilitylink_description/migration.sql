-- CreateTable
CREATE TABLE "UtilityLink" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UtilityLink_createdAt_idx" ON "UtilityLink"("createdAt");
