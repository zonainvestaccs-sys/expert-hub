-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappBlastEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappBlastIframeUrl" TEXT;
