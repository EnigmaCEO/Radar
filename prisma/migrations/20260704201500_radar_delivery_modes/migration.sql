ALTER TABLE "radar_delivery_destinations"
ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'alert_fanout';
