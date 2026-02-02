/*
  Warnings:

  - You are about to drop the column `telegramGroupUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `whatsappGroupUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "telegramGroupUrl",
DROP COLUMN "whatsappGroupUrl",
ADD COLUMN     "telegramUrl" TEXT,
ADD COLUMN     "whatsappUrl" TEXT;
