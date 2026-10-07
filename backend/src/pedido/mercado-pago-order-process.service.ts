import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient, PaymentMethod, PaymentStatus, PedidoEstado } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MercadoPagoOrderDetails } from '../mercado-pago/mercado-pago.types';
import { MercadoPagoOrderAction } from './mercado-pago-order-status.mapper';

const mercadoPagoPedidoSelect = {
  id: true,
  estado: true,
  payment: {
    select: {
      method: true,
      status: true,
      providerOrderId: true,
    },
  },
  items: {
    select: {
      productId: true,
      cantidad: true,
    },
  },
} satisfies Prisma.PedidoSelect;

type MercadoPagoPedido = Prisma.PedidoGetPayload<{
  select: typeof mercadoPagoPedidoSelect;
}>;

@Injectable()
export class MercadoPagoOrderProcessService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async process(
    action: MercadoPagoOrderAction,
    pedidoId: number,
    order: MercadoPagoOrderDetails,
  ): Promise<void> {
    if (action === 'NO_ACTION' || action === 'PARTIALLY_REFUNDED') {
      return;
    }

    const existingPedido = await this.findPedido(this.prisma, pedidoId);
    this.ensureMercadoPagoPayment(existingPedido);

    if (this.isAlreadyProcessed(action, existingPedido)) {
      return;
    }

    await this.prisma.$transaction(async (transaction) => {
      const pedido = await this.findPedido(transaction, pedidoId);
      this.ensureMercadoPagoPayment(pedido);

      switch (action) {
        case 'APPROVED':
          await this.processApproved(transaction, pedido, order);
          return;
        case 'CANCELLED':
          await this.processCancelled(transaction, pedido);
          return;
        case 'REFUNDED':
          await this.processRefunded(transaction, pedido);
          return;
      }
    });
  }

  private async processApproved(
    transaction: Prisma.TransactionClient,
    pedido: MercadoPagoPedido,
    order: MercadoPagoOrderDetails,
  ): Promise<void> {
    if (
      pedido.estado !== PedidoEstado.PENDING ||
      pedido.payment?.status !== PaymentStatus.PENDING
    ) {
      throw new Error('Mercado Pago order references an incompatible pedido state');
    }

    await transaction.payment.update({
      where: { pedidoId: pedido.id },
      data: {
        status: PaymentStatus.APPROVED,
        providerOrderId: order.providerOrderId,
      },
    });
    await transaction.pedido.update({
      where: { id: pedido.id },
      data: { estado: PedidoEstado.CONFIRMED },
    });
  }

  private async processCancelled(
    transaction: Prisma.TransactionClient,
    pedido: MercadoPagoPedido,
  ): Promise<void> {
    const payment = pedido.payment;
    if (
      !payment ||
      (payment.status !== PaymentStatus.PENDING &&
        payment.status !== PaymentStatus.CANCELLED) ||
      (pedido.estado !== PedidoEstado.PENDING &&
        pedido.estado !== PedidoEstado.CANCELLED)
    ) {
      throw new Error('Mercado Pago order references an incompatible pedido state');
    }

    const shouldRestoreStock = pedido.estado !== PedidoEstado.CANCELLED;

    if (payment.status !== PaymentStatus.CANCELLED) {
      await transaction.payment.update({
        where: { pedidoId: pedido.id },
        data: { status: PaymentStatus.CANCELLED },
      });
    }

    if (pedido.estado !== PedidoEstado.CANCELLED) {
      await transaction.pedido.update({
        where: { id: pedido.id },
        data: { estado: PedidoEstado.CANCELLED },
      });
    }

    if (shouldRestoreStock) {
      await this.restoreStock(transaction, pedido.items);
    }
  }

  private async processRefunded(
    transaction: Prisma.TransactionClient,
    pedido: MercadoPagoPedido,
  ): Promise<void> {
    const payment = pedido.payment;
    if (
      !payment ||
      (payment.status !== PaymentStatus.APPROVED &&
        payment.status !== PaymentStatus.CANCELLED &&
        payment.status !== PaymentStatus.REFUNDED) ||
      (pedido.estado !== PedidoEstado.CONFIRMED &&
        pedido.estado !== PedidoEstado.CANCELLED)
    ) {
      throw new Error('Mercado Pago order references an incompatible pedido state');
    }

    const shouldRestoreStock = pedido.estado !== PedidoEstado.CANCELLED;

    if (payment.status !== PaymentStatus.REFUNDED) {
      await transaction.payment.update({
        where: { pedidoId: pedido.id },
        data: { status: PaymentStatus.REFUNDED },
      });
    }

    if (pedido.estado !== PedidoEstado.CANCELLED) {
      await transaction.pedido.update({
        where: { id: pedido.id },
        data: { estado: PedidoEstado.CANCELLED },
      });
    }

    if (shouldRestoreStock) {
      await this.restoreStock(transaction, pedido.items);
    }
  }
  
  private async findPedido(
    client: PrismaClient | Prisma.TransactionClient,
    pedidoId: number,
  ): Promise<MercadoPagoPedido | null> {
    return client.pedido.findUnique({
      where: { id: pedidoId },
      select: mercadoPagoPedidoSelect,
    });
  }
  
  private ensureMercadoPagoPayment(
    pedido: MercadoPagoPedido | null,
  ): asserts pedido is MercadoPagoPedido {
    if (!pedido) {
      throw new Error('Mercado Pago order references an unknown pedido');
    }
    
    if (!pedido.payment || pedido.payment.method !== PaymentMethod.MERCADO_PAGO) {
      throw new Error('Mercado Pago order references an incompatible payment');
    }
  }
  
  private isAlreadyProcessed(
    action: MercadoPagoOrderAction,
    pedido: MercadoPagoPedido,
  ): boolean {
    const payment = pedido.payment;
    if (!payment) {
      return false;
    }
    
    return (
      (action === 'APPROVED' &&
        pedido.estado === PedidoEstado.CONFIRMED &&
        payment.status === PaymentStatus.APPROVED) ||
      (action === 'CANCELLED' &&
        pedido.estado === PedidoEstado.CANCELLED &&
        payment.status === PaymentStatus.CANCELLED) ||
      (action === 'REFUNDED' &&
        pedido.estado === PedidoEstado.CANCELLED &&
        payment.status === PaymentStatus.REFUNDED)
    );
  }     
        
  private async restoreStock(
    transaction: Prisma.TransactionClient,
    items: MercadoPagoPedido['items'],
  ): Promise<void> {
    for (const item of items) {
      await transaction.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.cantidad } },
      });
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
      