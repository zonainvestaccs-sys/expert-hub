-- CreateEnum
CREATE TYPE "RecurrenceFreq" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "isException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "occurrenceIndex" INTEGER,
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "AppointmentSeries" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "freq" "RecurrenceFreq" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "endMode" TEXT NOT NULL,
    "count" INTEGER,
    "until" TIMESTAMP(3),
    "byWeekday" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentSeries_expertId_createdAt_idx" ON "AppointmentSeries"("expertId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentSeries_expertId_startAt_idx" ON "AppointmentSeries"("expertId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_seriesId_startAt_idx" ON "Appointment"("seriesId", "startAt");

-- AddForeignKey
ALTER TABLE "AppointmentSeries" ADD CONSTRAINT "AppointmentSeries_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "AppointmentSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
