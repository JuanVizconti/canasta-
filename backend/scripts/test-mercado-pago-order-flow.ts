/*import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MercadoPagoOrderDetails } from '../src/mercado-pago/mercado-pago.types';
import { PedidoService } from '../src/pedido/pedido.service';

type Scenario =
  | 'CANCELLED'
  | 'REFUNDED'
  | 'CANCELLED_THEN_REFUNDED'
  | 'PARTIALLY_REFUNDED';

// Editar estos dos valores antes de ejecutar el script.
const pedidoId = 43;
const scenario: Scenario = 'CANCELLED_THEN_REFUNDED';

type PedidoServicePrismaAccess = {
  prisma: PrismaClient;
};

function buildOrder(
  providerOrderId: string,
  externalReference: string,
  status: string,
  statusDetail: string | null,
): MercadoPagoOrderDetails {
  return {
    providerOrderId,
    externalReference,
    status,
    statusDetail,
  };
}

async function printPedidoState(
  prisma: PrismaClient,
  targetPedidoId: number,
  label: string,
): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: targetPedidoId },
    select: {
      id: true,
      estado: true,
      payment: {
        select: {
          status: true,
          method: true,
          providerOrderId: true,
        },
      },
      items: {
        select: {
          productId: true,
          nombre: true,
          cantidad: true,
          product: {
            select: { stock: true },
          },
        },
      },
    },
  });

  console.log(`\n--- ${label} ---`);

  if (!pedido) {
    console.log(`No se encontró el Pedido ${targetPedidoId}.`);
    return;
  }
  console.log({
    pedidoId: pedido.id,
    pedidoEstado: pedido.estado,
    paymentStatus: pedido.payment?.status ?? null,
    paymentMethod: pedido.payment?.method ?? null,
    providerOrderId: pedido.payment?.providerOrderId ?? null,
  });

  console.table(
    pedido.items.map((item) => ({
      productId: item.productId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      currentProductStock: item.product.stock,
    })),
  );
}

async function main(): Promise<void> {
  let app: INestApplicationContext | undefined;

  try {
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      throw new Error('Configurar un pedidoId entero positivo antes de ejecutar el script.');
    }

    app = await NestFactory.createApplicationContext(AppModule);
    const pedidoService = app.get(PedidoService);

    // El proyecto no expone PrismaService por DI. Se reutiliza el cliente ya
    // configurado por PedidoService exclusivamente para las consultas de estado.
    const prisma = (pedidoService as unknown as PedidoServicePrismaAccess).prisma;
    const externalReference = String(pedidoId);

    await printPedidoState(prisma, pedidoId, 'Estado inicial');
    switch (scenario) {
      case 'CANCELLED': {
        const order = buildOrder(
          'ORD-TEMP-CANCELLED',
          externalReference,
          'canceled',
          'canceled',
        );

        await pedidoService.processMercadoPagoOrder(order);
        await printPedidoState(prisma, pedidoId, 'Después de CANCELLED');

        await pedidoService.processMercadoPagoOrder(order);
        await printPedidoState(prisma, pedidoId, 'Después de repetir CANCELLED');
        break;
      }

      case 'REFUNDED': {
        const order = buildOrder(
          'ORD-TEMP-REFUNDED',
          externalReference,
          'refunded',
          'refunded',
        );

        await pedidoService.processMercadoPagoOrder(order);
        await printPedidoState(prisma, pedidoId, 'Después de REFUNDED');

        await pedidoService.processMercadoPagoOrder(order);
        await printPedidoState(prisma, pedidoId, 'Después de repetir REFUNDED');
        break;
      }
      case 'CANCELLED_THEN_REFUNDED': {
        const cancelledOrder = buildOrder(
          'ORD-TEMP-CANCELLED-FIRST',
          externalReference,
          'canceled',
          'canceled',
        );
        const refundedOrder = buildOrder(
          'ORD-TEMP-REFUNDED-AFTER-CANCEL',
          externalReference,
          'refunded',
          'refunded',
        );

        await pedidoService.processMercadoPagoOrder(cancelledOrder);
        await printPedidoState(prisma, pedidoId, 'Después de CANCELLED');

        await pedidoService.processMercadoPagoOrder(refundedOrder);
        await printPedidoState(prisma, pedidoId, 'Después de REFUNDED posterior');
        break;
      }

      case 'PARTIALLY_REFUNDED': {
        const order = buildOrder(
          'ORD-TEMP-PARTIAL',
          externalReference,
          'processed',
          'partially_refunded',
        );

        await pedidoService.processMercadoPagoOrder(order);
        await printPedidoState(prisma, pedidoId, 'Después de PARTIALLY_REFUNDED');
        break;
      }
    }
  } catch (error) {
    console.error('La validación manual falló:', error);
    process.exitCode = 1;
  } finally {
    if (app) {
      await app.close();
    }
  }
}

void main();*/
