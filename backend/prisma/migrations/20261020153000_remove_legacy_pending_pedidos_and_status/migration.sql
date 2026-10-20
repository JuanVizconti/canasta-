-- Remove legacy orders created by the retired pre-payment flow.
-- Their dependent records must be deleted before dropping the enum value.
BEGIN;

DELETE FROM "Payment"
WHERE "pedidoId" IN (
  SELECT "id" FROM "Pedido" WHERE "estado" = 'PENDING'
);

DELETE FROM "PedidoItem"
WHERE "pedidoId" IN (
  SELECT "id" FROM "Pedido" WHERE "estado" = 'PENDING'
);

DELETE FROM "Pedido" WHERE "estado" = 'PENDING';

CREATE TYPE "PedidoEstado_new" AS ENUM ('CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
ALTER TABLE "Pedido" ALTER COLUMN "estado" TYPE "PedidoEstado_new" USING ("estado"::text::"PedidoEstado_new");
ALTER TYPE "PedidoEstado" RENAME TO "PedidoEstado_old";
ALTER TYPE "PedidoEstado_new" RENAME TO "PedidoEstado";
DROP TYPE "public"."PedidoEstado_old";

COMMIT;
