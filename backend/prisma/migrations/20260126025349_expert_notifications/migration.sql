-- CreateTable
CREATE TABLE "ExpertNotificationRule" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "times" TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertNotification" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ACTIVATION',
    "dateIso" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpertNotificationRule_expertId_key" ON "ExpertNotificationRule"("expertId");

-- CreateIndex
CREATE INDEX "ExpertNotificationRule_expertId_idx" ON "ExpertNotificationRule"("expertId");

-- CreateIndex
CREATE INDEX "ExpertNotification_expertId_isRead_createdAt_idx" ON "ExpertNotification"("expertId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "ExpertNotification_expertId_createdAt_idx" ON "ExpertNotification"("expertId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExpertNotificationRule" ADD CONSTRAINT "ExpertNotificationRule_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertNotification" ADD CONSTRAINT "ExpertNotification_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
