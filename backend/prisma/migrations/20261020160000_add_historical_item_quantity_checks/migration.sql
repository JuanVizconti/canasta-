-- Historical item snapshots preserve quantities that must always be positive.
ALTER TABLE "CheckoutSnapshotItem"
ADD CONSTRAINT "CheckoutSnapshotItem_cantidad_positive" CHECK ("cantidad" > 0);

ALTER TABLE "PedidoItem"
ADD CONSTRAINT "PedidoItem_cantidad_positive" CHECK ("cantidad" > 0);
