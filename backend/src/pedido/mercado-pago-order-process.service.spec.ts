import { PaymentMethod, PaymentStatus, PedidoEstado } from '@prisma/client';
import { MercadoPagoOrderDetails } from '../mercado-pago/mercado-pago.types';
import { MercadoPagoOrderProcessService } from './mercado-pago-order-process.service';

describe('MercadoPagoOrderProcessService', () => {
  const approvedOrder = (
    overrides: Partial<MercadoPagoOrderDetails> = {},
  ): MercadoPagoOrderDetails => ({
    providerOrderId: 'mp-order-approved',
    externalReference: '24',
    status: 'processed',
    statusDetail: 'accredited',
    ...overrides,
  });

  const pedido = (overrides: Record<string, unknown> = {}) => ({
    id: 24,
    estado: PedidoEstado.PENDING,
    payment: {
      method: PaymentMethod.MERCADO_PAGO,
      status: PaymentStatus.PENDING,
      providerOrderId: 'mp-order-previous',
    },
    items: [
      { productId: 5, cantidad: 2 },
      { productId: 8, cantidad: 3 },
    ],
    ...overrides,
  });

  const createService = (currentPedido = pedido()) => {
    const service = new MercadoPagoOrderProcessService();
    const transaction = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue(currentPedido),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: { update: jest.fn().mockResolvedValue({}) },
      product: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      pedido: { findUnique: jest.fn().mockResolvedValue(currentPedido) },
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    return { service, prisma, transaction };
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('approves a pending Mercado Pago payment and confirms its pedido atomically', async () => {
    const { service, prisma, transaction } = createService();

    await service.process('APPROVED', 24, approvedOrder());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 24 },
      data: {
        status: PaymentStatus.APPROVED,
        providerOrderId: 'mp-order-approved',
      },
    });
    expect(transaction.pedido.update).toHaveBeenCalledWith({
      where: { id: 24 },
      data: { estado: PedidoEstado.CONFIRMED },
    });
    expect(transaction.product.update).not.toHaveBeenCalled();
  });

  it('accepts an approved retry order with a different providerOrderId', async () => {
    const { service, transaction } = createService();

    await service.process('APPROVED', 24, approvedOrder({
      providerOrderId: 'mp-order-approved-after-retry',
    }));

    expect(transaction.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        providerOrderId: 'mp-order-approved-after-retry',
      }),
    }));
  });

  it('is idempotent for an already approved and confirmed pedido', async () => {
    const { service, prisma } = createService(pedido({
      estado: PedidoEstado.CONFIRMED,
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.APPROVED,
        providerOrderId: 'mp-order-approved',
      },
    }));

    await service.process('APPROVED', 24, approvedOrder());

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cancels a pending pedido and restores stock from every PedidoItem once', async () => {
    const { service, transaction } = createService();

    await service.process('CANCELLED', 24, approvedOrder({
      status: 'canceled',
      statusDetail: 'canceled',
    }));

    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 24 },
      data: { status: PaymentStatus.CANCELLED },
    });
    expect(transaction.pedido.update).toHaveBeenCalledWith({
      where: { id: 24 },
      data: { estado: PedidoEstado.CANCELLED },
    });
    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { stock: { increment: 2 } },
    });
    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { stock: { increment: 3 } },
    });
  });

  it('does not restore stock twice for a repeated cancelled webhook', async () => {
    const { service, prisma } = createService(pedido({
      estado: PedidoEstado.CANCELLED,
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.CANCELLED,
        providerOrderId: 'mp-order-cancelled',
      },
    }));

    await service.process('CANCELLED', 24, approvedOrder());

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['payment is missing', pedido({ payment: null })],
    ['payment is not Mercado Pago', pedido({
      payment: {
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING,
        providerOrderId: null,
      },
    })],
  ])('rejects cancellation when %s without restoring stock', async (_description, currentPedido) => {
    const { service, prisma } = createService(currentPedido);

    await expect(service.process('CANCELLED', 24, approvedOrder()))
      .rejects.toThrow('Mercado Pago order references an incompatible payment');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['payment', 'pedido', 'product'] as const)(
    'propagates a transaction failure while cancelling through %s',
    async (failingOperation) => {
      const { service, transaction } = createService();
      transaction[failingOperation].update.mockRejectedValueOnce(new Error('database failure'));

      await expect(service.process('CANCELLED', 24, approvedOrder()))
        .rejects.toThrow('database failure');
    },
  );

  it('refunds a non-cancelled pedido and restores its reserved stock', async () => {
    const { service, transaction } = createService(pedido({
      estado: PedidoEstado.CONFIRMED,
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.APPROVED,
        providerOrderId: 'mp-order-approved',
      },
    }));

    await service.process('REFUNDED', 24, approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }));

    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 24 },
      data: { status: PaymentStatus.REFUNDED },
    });
    expect(transaction.pedido.update).toHaveBeenCalledWith({
      where: { id: 24 },
      data: { estado: PedidoEstado.CANCELLED },
    });
    expect(transaction.product.update).toHaveBeenCalledTimes(2);
  });

  it('rejects a refund for a pending pedido without modifying payment, pedido, or stock', async () => {
    const { service, transaction } = createService(pedido({
      estado: PedidoEstado.PENDING,
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.PENDING,
        providerOrderId: 'mp-order-pending',
      },
    }));

    await expect(service.process('REFUNDED', 24, approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }))).rejects.toThrow('Mercado Pago order references an incompatible pedido state');

    expect(transaction.payment.update).not.toHaveBeenCalled();
    expect(transaction.pedido.update).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
  });

  it('updates a cancelled payment to REFUNDED without restoring stock again', async () => {
    const { service, transaction } = createService(pedido({
      estado: PedidoEstado.CANCELLED,
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.CANCELLED,
        providerOrderId: 'mp-order-cancelled',
      },
    }));

    await service.process('REFUNDED', 24, approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }));

    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 24 },
      data: { status: PaymentStatus.REFUNDED },
    });
    expect(transaction.pedido.update).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
  });

  it('is idempotent for an already refunded and cancelled pedido', async () => {
    const { service, prisma } = createService(pedido({
      estado: PedidoEstado.CANCELLED,
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.REFUNDED,
        providerOrderId: 'mp-order-refunded',
      },
    }));

    await service.process('REFUNDED', 24, approvedOrder());

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['NO_ACTION', 'PARTIALLY_REFUNDED'] as const)(
    'does not access the database for %s',
    async (action) => {
      const { service, prisma } = createService();

      await service.process(action, 24, approvedOrder());

      expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
