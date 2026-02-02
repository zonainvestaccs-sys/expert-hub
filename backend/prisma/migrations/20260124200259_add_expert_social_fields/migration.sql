/*
  Warnings:

  - You are about to drop the column `telegramUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `whatsappUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "telegramUrl",
DROP COLUMN "whatsappUrl",
ADD COLUMN     "telegramGroupUrl" TEXT,
ADD COLUMN     "whatsappGroupUrl" TEXT;
