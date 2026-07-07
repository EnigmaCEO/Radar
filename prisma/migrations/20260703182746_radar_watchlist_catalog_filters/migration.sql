/*
  Warnings:

  - You are about to drop the column `minimumSeverity` on the `radar_watchlists` table. All the data in the column will be lost.
  - You are about to drop the column `sources` on the `radar_watchlists` table. All the data in the column will be lost.
  - The `monitorTypes` column on the `radar_watchlists` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `assets` column on the `radar_watchlists` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `chains` column on the `radar_watchlists` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "radar_watchlists" DROP COLUMN "minimumSeverity",
DROP COLUMN "sources",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "matchMode" TEXT NOT NULL DEFAULT 'any',
ADD COLUMN     "minSeverity" TEXT NOT NULL DEFAULT 'watch',
ADD COLUMN     "objectIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "providers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "purposes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "signalClasses" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "statuses" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "monitorTypes",
ADD COLUMN     "monitorTypes" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "assets",
ADD COLUMN     "assets" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "chains",
ADD COLUMN     "chains" JSONB NOT NULL DEFAULT '[]';
