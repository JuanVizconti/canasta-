-- DropIndex
DROP INDEX "Payment_idempotencyKey_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "checkoutUrl",
DROP COLUMN "idempotencyKey";

-- AlterTable
ALTER TABLE "Pedido" DROP COLUMN "expiresAt";
