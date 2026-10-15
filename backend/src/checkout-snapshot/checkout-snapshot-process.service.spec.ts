import {
  CheckoutSnapshotStatus,
  PaymentMethod,
  PaymentStatus,
  PedidoEstado,
  Prisma,
} from '@prisma/client';
import { MercadoPagoOrderDetails } from '../mercado-pago/mercado-pago.types';
import { PedidoService } from '../pedido/pedido.service';
import { CheckoutSnapshotProcessService } from './checkout-snapshot-process.service';

describe('CheckoutSnapshotProcessService', () => {
  const approvedOrder = (
    overrides: Partial<MercadoPagoOrderDetails> = {},
  ): MercadoPagoOrderDetails => ({
    providerOrderId: 'mp-order-20',
    externalReference: '20',
    status: 'processed',
    statusDetail: 'accredited',
    ...overrides,
  });

  const activeSnapshot = (overrides: Record<string, unknown> = {}) => ({
    id: 20,
    userId: 7,
    status: CheckoutSnapshotStatus.ACTIVE,
    providerOrderId: 'mp-order-20',
    checkoutUrl: 'https://mercadopago.example/checkout/20',
    idempotencyKey: 'snapshot-key-20',
    expiresAt: new Date('2026-10-13T18:30:00.000Z'),
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
    deliveryMethod: 'DELIVERY',
    calle: 'Siempre Viva',
    numero: '123',
    localidad: 'Springfield',
    codigoPostal: '1000',
    piso: '2',
    departamento: 'B',
    especificaciones: 'Tocar timbre',
    subtotal: new Prisma.Decimal('25000.00'),
    serviceFee: new Prisma.Decimal('500.00'),
    deliveryFee: new Prisma.Decimal('2500.00'),
    total: new Prisma.Decimal('28000.00'),
    pedidoId: null,
    items: [
      {
        productId: 4,
        nombre: 'Arroz',
        marca: 'Canasta',
        cantidad: 2,
        unitPrice: new Prisma.Decimal('10000.00'),
      },
      {
        productId: 8,
        nombre: 'Aceite',
        marca: 'Canasta',
        cantidad: 1,
        unitPrice: new Prisma.Decimal('5000.00'),
      },
    ],
    ...overrides,
  });

  const createService = (snapshot = activeSnapshot()) => {
    const pedidoService = {
      processMercadoPagoRefund: jest.fn().mockResolvedValue(undefined),
    } as unknown as PedidoService;
    const service = new CheckoutSnapshotProcessService(pedidoService);
    const itemCount = snapshot && 'items' in snapshot ? snapshot.items.length : 0;
    const transaction = {
      checkoutSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
        update: jest.fn().mockResolvedValue({}),
      },
      product: {
        update: jest.fn().mockResolvedValue({}),
      },
      pedido: {
        create: jest.fn().mockResolvedValue({ id: 91 }),
      },
      pedidoItem: {
        createMany: jest.fn().mockResolvedValue({ count: itemCount }),
      },
      payment: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      checkoutSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
      },
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    return { service, prisma, transaction, pedidoService };
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('turns an ACTIVE approved snapshot into a confirmed pedido, items, approved payment, and completed snapshot atomically', async () => {
    const { service, prisma, transaction } = createService();

    await expect(service.processApprovedOrder(approvedOrder())).resolves.toBeUndefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.pedido.create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        nombre: 'Juan',
        apellido: 'Perez',
        dni: '12345678',
        telefono: '1122334455',
        deliveryMethod: 'DELIVERY',
        calle: 'Siempre Viva',
        numero: '123',
        localidad: 'Springfield',
        codigoPostal: '1000',
        piso: '2',
        departamento: 'B',
        especificaciones: 'Tocar timbre',
        subtotal: new Prisma.Decimal('25000.00'),
        serviceFee: new Prisma.Decimal('500.00'),
        deliveryFee: new Prisma.Decimal('2500.00'),
        total: new Prisma.Decimal('28000.00'),
        estado: PedidoEstado.CONFIRMED,
        expiresAt: new Date('2026-10-13T18:30:00.000Z'),
      },
      select: { id: true },
    });
    expect(transaction.pedidoItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          pedidoId: 91,
          productId: 4,
          nombre: 'Arroz',
          marca: 'Canasta',
          cantidad: 2,
          unitPrice: new Prisma.Decimal('10000.00'),
        },
        {
          pedidoId: 91,
          productId: 8,
          nombre: 'Aceite',
          marca: 'Canasta',
          cantidad: 1,
          unitPrice: new Prisma.Decimal('5000.00'),
        },
      ],
    });
    expect(transaction.payment.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 91,
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.APPROVED,
        providerOrderId: 'mp-order-20',
        checkoutUrl: 'https://mercadopago.example/checkout/20',
        idempotencyKey: 'snapshot-key-20',
      },
    });
    expect(transaction.checkoutSnapshot.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: {
        status: CheckoutSnapshotStatus.COMPLETED,
        pedidoId: 91,
      },
    });
    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction).not.toHaveProperty('cart');
    expect(transaction).not.toHaveProperty('cartItem');
  });

  it('copies nullable provider metadata from the snapshot without generating a new key', async () => {
    const snapshot = activeSnapshot({
      providerOrderId: null,
      checkoutUrl: null,
      idempotencyKey: null,
    });
    const { service, transaction } = createService(snapshot);

    await service.processApprovedOrder(approvedOrder());

    expect(transaction.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerOrderId: 'mp-order-20',
        checkoutUrl: null,
        idempotencyKey: null,
      }),
    });
  });

  it('is idempotent when the snapshot is already completed and linked to a pedido', async () => {
    const completedSnapshot = activeSnapshot({
      status: CheckoutSnapshotStatus.COMPLETED,
      pedidoId: 91,
    });
    const { service, prisma } = createService(completedSnapshot);

    await expect(service.processApprovedOrder(approvedOrder())).resolves.toBeUndefined();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '15abc', '0', '-1'])(
    'rejects an invalid external reference without querying or mutating the database: %s',
    async (externalReference) => {
      const { service, prisma } = createService();

      await expect(service.processApprovedOrder(approvedOrder({ externalReference })))
        .rejects.toThrow('Mercado Pago order external reference is invalid');

      expect(prisma.checkoutSnapshot.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown snapshot without starting a transaction', async () => {
    const { service, prisma } = createService(null as never);

    await expect(service.processApprovedOrder(approvedOrder()))
      .rejects.toThrow('Checkout snapshot not found');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([CheckoutSnapshotStatus.EXPIRED, CheckoutSnapshotStatus.FAILED])(
    'rejects a %s snapshot without mutation',
    async (status) => {
      const { service, prisma } = createService(activeSnapshot({ status }));

      await expect(service.processApprovedOrder(approvedOrder()))
        .rejects.toThrow('Checkout snapshot cannot be completed');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    activeSnapshot({
      status: CheckoutSnapshotStatus.COMPLETED,
      pedidoId: null,
    }),
    activeSnapshot({ pedidoId: 91 }),
  ])('rejects an inconsistent snapshot without mutation', async (snapshot) => {
    const { service, prisma } = createService(snapshot);

    await expect(service.processApprovedOrder(approvedOrder()))
      .rejects.toThrow(/inconsistent state|cannot be completed/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a provider order that does not belong to the snapshot', async () => {
    const { service, prisma } = createService(activeSnapshot({
      providerOrderId: 'mp-order-other',
    }));

    await expect(service.processApprovedOrder(approvedOrder()))
      .rejects.toThrow('Mercado Pago order does not match checkout snapshot');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['pedido creation', 'pedido', 'create'],
    ['pedido item creation', 'pedidoItem', 'createMany'],
    ['payment creation', 'payment', 'create'],
    ['snapshot completion', 'checkoutSnapshot', 'update'],
  ] as const)('propagates a %s failure so the transaction rolls back', async (_name, section, method) => {
    const { service, transaction } = createService();
    const failure = new Error('database failure');
    (transaction[section][method] as jest.Mock).mockRejectedValueOnce(failure);

    await expect(service.processApprovedOrder(approvedOrder())).rejects.toThrow(failure);
  });

  it('expires an ACTIVE snapshot and restores every reserved product stock atomically', async () => {
    const { service, prisma, transaction } = createService();

    await expect(service.processCancelledOrder(approvedOrder({
      status: 'canceled',
      statusDetail: 'canceled',
    }))).resolves.toBeUndefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { stock: { increment: 2 } },
    });
    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { stock: { increment: 1 } },
    });
    expect(transaction.checkoutSnapshot.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { status: CheckoutSnapshotStatus.EXPIRED },
    });
    expect(transaction.pedido.create).not.toHaveBeenCalled();
    expect(transaction.pedidoItem.createMany).not.toHaveBeenCalled();
    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it.each([
    CheckoutSnapshotStatus.EXPIRED,
    CheckoutSnapshotStatus.FAILED,
    CheckoutSnapshotStatus.COMPLETED,
  ])('does not restore stock or mutate a %s snapshot after a cancelled webhook', async (status) => {
    const snapshot = activeSnapshot({
      status,
      pedidoId: status === CheckoutSnapshotStatus.COMPLETED ? 91 : null,
    });
    const { service, prisma, transaction } = createService(snapshot);

    await expect(service.processCancelledOrder(approvedOrder({
      status: 'canceled',
      statusDetail: 'canceled',
    }))).resolves.toBeUndefined();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.checkoutSnapshot.update).not.toHaveBeenCalled();
    expect(transaction.pedido.create).not.toHaveBeenCalled();
    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it('rejects a cancelled webhook from a different provider order without mutation', async () => {
    const { service, prisma } = createService(activeSnapshot({
      providerOrderId: 'mp-order-other',
    }));

    await expect(service.processCancelledOrder(approvedOrder({
      providerOrderId: 'mp-order-20',
      status: 'canceled',
      statusDetail: 'canceled',
    }))).rejects.toThrow('Mercado Pago order does not match checkout snapshot');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '12abc', '0', '-1'])(
    'rejects invalid cancelled-order external references without mutation: %s',
    async (externalReference) => {
      const { service, prisma } = createService();

      await expect(service.processCancelledOrder(approvedOrder({
        externalReference,
        status: 'canceled',
        statusDetail: 'canceled',
      }))).rejects.toThrow('Mercado Pago order external reference is invalid');

      expect(prisma.checkoutSnapshot.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects a cancelled webhook for an unknown snapshot without mutation', async () => {
    const { service, prisma } = createService(null as never);

    await expect(service.processCancelledOrder(approvedOrder({
      status: 'canceled',
      statusDetail: 'canceled',
    }))).rejects.toThrow('Checkout snapshot not found');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not mark the snapshot expired when stock restoration fails', async () => {
    const { service, transaction } = createService();
    const failure = new Error('stock update failed');
    transaction.product.update.mockRejectedValueOnce(failure);

    await expect(service.processCancelledOrder(approvedOrder({
      status: 'canceled',
      statusDetail: 'canceled',
    }))).rejects.toThrow(failure);

    expect(transaction.checkoutSnapshot.update).not.toHaveBeenCalled();
  });

  it('propagates snapshot-expiration failures so the transaction rolls back stock restoration', async () => {
    const { service, transaction } = createService();
    const failure = new Error('snapshot update failed');
    transaction.checkoutSnapshot.update.mockRejectedValueOnce(failure);

    await expect(service.processCancelledOrder(approvedOrder({
      status: 'canceled',
      statusDetail: 'canceled',
    }))).rejects.toThrow(failure);

    expect(transaction.product.update).toHaveBeenCalledTimes(2);
  });

  it('delegates a completed snapshot refund to the pedido domain without mutating the snapshot', async () => {
    const completedSnapshot = activeSnapshot({
      status: CheckoutSnapshotStatus.COMPLETED,
      pedidoId: 91,
    });
    const { service, prisma, pedidoService } = createService(completedSnapshot);
    const order = approvedOrder({
      providerOrderId: 'mp-order-20',
      status: 'refunded',
      statusDetail: 'refunded',
    });

    await expect(service.processRefundedOrder(order)).resolves.toBeUndefined();

    expect(pedidoService.processMercadoPagoRefund).toHaveBeenCalledWith(
      91,
      'mp-order-20',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '15abc', '0', '-1'])(
    'rejects invalid refunded-order external references without delegating: %s',
    async (externalReference) => {
      const { service, prisma, pedidoService } = createService();

      await expect(service.processRefundedOrder(approvedOrder({
        externalReference,
        status: 'refunded',
        statusDetail: 'refunded',
      }))).rejects.toThrow('Mercado Pago order external reference is invalid');

      expect(prisma.checkoutSnapshot.findUnique).not.toHaveBeenCalled();
      expect(pedidoService.processMercadoPagoRefund).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown snapshot refund without delegating', async () => {
    const { service, pedidoService } = createService(null as never);

    await expect(service.processRefundedOrder(approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }))).rejects.toThrow('Checkout snapshot not found');

    expect(pedidoService.processMercadoPagoRefund).not.toHaveBeenCalled();
  });

  it('rejects a refund from a different provider order without delegating', async () => {
    const completedSnapshot = activeSnapshot({
      status: CheckoutSnapshotStatus.COMPLETED,
      pedidoId: 91,
      providerOrderId: 'mp-order-other',
    });
    const { service, pedidoService } = createService(completedSnapshot);

    await expect(service.processRefundedOrder(approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }))).rejects.toThrow('Mercado Pago order does not match checkout snapshot');

    expect(pedidoService.processMercadoPagoRefund).not.toHaveBeenCalled();
  });

  it.each([
    CheckoutSnapshotStatus.ACTIVE,
    CheckoutSnapshotStatus.EXPIRED,
    CheckoutSnapshotStatus.FAILED,
  ])('rejects a refund for a %s snapshot without delegating', async (status) => {
    const { service, pedidoService } = createService(activeSnapshot({ status }));

    await expect(service.processRefundedOrder(approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }))).rejects.toThrow('Checkout snapshot is not completed');

    expect(pedidoService.processMercadoPagoRefund).not.toHaveBeenCalled();
  });

  it('rejects a completed snapshot without pedidoId without delegating', async () => {
    const { service, pedidoService } = createService(activeSnapshot({
      status: CheckoutSnapshotStatus.COMPLETED,
      pedidoId: null,
    }));

    await expect(service.processRefundedOrder(approvedOrder({
      status: 'refunded',
      statusDetail: 'refunded',
    }))).rejects.toThrow('Checkout snapshot is in an inconsistent state');

    expect(pedidoService.processMercadoPagoRefund).not.toHaveBeenCalled();
  });
});
