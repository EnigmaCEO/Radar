/*
  Warnings:

  - You are about to drop the column `error` on the `radar_delivery_logs` table. All the data in the column will be lost.
  - Added the required column `accountId` to the `radar_delivery_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channel` to the `radar_delivery_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "radar_delivery_logs" DROP COLUMN "error",
ADD COLUMN     "accountId" TEXT NOT NULL,
ADD COLUMN     "alertIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "channel" TEXT NOT NULL,
ADD COLUMN     "externalIds" JSONB,
ADD COLUMN     "messageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sanitizedError" TEXT,
ADD COLUMN     "watchlistId" TEXT;

-- AddForeignKey
ALTER TABLE "radar_delivery_logs" ADD CONSTRAINT "radar_delivery_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "radar_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
