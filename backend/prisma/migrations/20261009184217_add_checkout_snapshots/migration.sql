-- CreateEnum
CREATE TYPE "CheckoutSnapshotStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "CheckoutSnapshot" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "CheckoutSnapshotStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerOrderId" TEXT,
    "checkoutUrl" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "calle" TEXT,
    "numero" TEXT,
    "localidad" TEXT,
    "codigoPostal" TEXT,
    "piso" TEXT,
    "departamento" TEXT,
    "especificaciones" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "pedidoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSnapshotItem" (
    "id" SERIAL NOT NULL,
    "checkoutSnapshotId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CheckoutSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSnapshot_providerOrderId_key" ON "CheckoutSnapshot"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSnapshot_idempotencyKey_key" ON "CheckoutSnapshot"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSnapshot_pedidoId_key" ON "CheckoutSnapshot"("pedidoId");

-- CreateIndex
CREATE INDEX "CheckoutSnapshot_userId_idx" ON "CheckoutSnapshot"("userId");

-- CreateIndex
CREATE INDEX "CheckoutSnapshot_status_idx" ON "CheckoutSnapshot"("status");

-- CreateIndex
CREATE INDEX "CheckoutSnapshot_expiresAt_idx" ON "CheckoutSnapshot"("expiresAt");

-- AddForeignKey
ALTER TABLE "CheckoutSnapshot" ADD CONSTRAINT "CheckoutSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSnapshot" ADD CONSTRAINT "CheckoutSnapshot_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSnapshotItem" ADD CONSTRAINT "CheckoutSnapshotItem_checkoutSnapshotId_fkey" FOREIGN KEY ("checkoutSnapshotId") REFERENCES "CheckoutSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSnapshotItem" ADD CONSTRAINT "CheckoutSnapshotItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
