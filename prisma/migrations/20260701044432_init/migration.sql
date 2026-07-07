-- CreateTable
CREATE TABLE "radar_accounts" (
    "id" TEXT NOT NULL,
    "ownerSub" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radar_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radar_watchlists" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "monitorTypes" TEXT[],
    "sources" TEXT[],
    "assets" TEXT[],
    "chains" TEXT[],
    "minimumSeverity" TEXT NOT NULL DEFAULT 'watch',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radar_watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radar_delivery_destinations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumSeverity" TEXT NOT NULL DEFAULT 'watch',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radar_delivery_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "radar_accounts_ownerSub_key" ON "radar_accounts"("ownerSub");

-- CreateIndex
CREATE UNIQUE INDEX "radar_accounts_stripeCustomerId_key" ON "radar_accounts"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "radar_accounts_stripeSubId_key" ON "radar_accounts"("stripeSubId");

-- AddForeignKey
ALTER TABLE "radar_watchlists" ADD CONSTRAINT "radar_watchlists_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "radar_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radar_delivery_destinations" ADD CONSTRAINT "radar_delivery_destinations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "radar_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
