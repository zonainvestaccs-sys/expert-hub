-- CreateTable
CREATE TABLE "MetricsDaily" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "leadsTotal" INTEGER NOT NULL DEFAULT 0,
    "leadsActive" INTEGER NOT NULL DEFAULT 0,
    "depositsCount" INTEGER NOT NULL DEFAULT 0,
    "depositsTotalCents" INTEGER NOT NULL DEFAULT 0,
    "ftdCount" INTEGER NOT NULL DEFAULT 0,
    "revCents" INTEGER NOT NULL DEFAULT 0,
    "salesCents" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "trafficCents" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricsDaily_day_idx" ON "MetricsDaily"("day");

-- CreateIndex
CREATE INDEX "MetricsDaily_expertId_idx" ON "MetricsDaily"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricsDaily_expertId_day_key" ON "MetricsDaily"("expertId", "day");

-- AddForeignKey
ALTER TABLE "MetricsDaily" ADD CONSTRAINT "MetricsDaily_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
