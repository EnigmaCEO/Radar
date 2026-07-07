-- AlterTable
ALTER TABLE "radar_delivery_destinations" ADD COLUMN     "configEncrypted" TEXT,
ADD COLUMN     "configPreview" JSONB,
ADD COLUMN     "lastPolledAt" TIMESTAMP(3),
ADD COLUMN     "pollingFrequency" TEXT NOT NULL DEFAULT '1hr';

-- CreateTable
CREATE TABLE "radar_delivery_logs" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "reportId" TEXT,
    "cadence" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radar_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "radar_delivery_logs" ADD CONSTRAINT "radar_delivery_logs_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "radar_delivery_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
