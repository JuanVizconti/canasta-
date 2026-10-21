-- CreateTable
CREATE TABLE "CommerceSettings" (
    "id" INTEGER NOT NULL,
    "minimumPurchaseAmount" DECIMAL(10,2) NOT NULL,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommerceSettings"
ADD CONSTRAINT "CommerceSettings_singleton_id" CHECK ("id" = 1),
ADD CONSTRAINT "CommerceSettings_minimum_purchase_non_negative" CHECK ("minimumPurchaseAmount" >= 0),
ADD CONSTRAINT "CommerceSettings_service_fee_non_negative" CHECK ("serviceFee" >= 0);

INSERT INTO "CommerceSettings" (
  "id",
  "minimumPurchaseAmount",
  "serviceFee",
  "updatedAt"
) VALUES (1, 10000.00, 500.00, CURRENT_TIMESTAMP);
