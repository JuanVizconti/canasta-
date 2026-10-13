import {
  CheckoutSnapshotStatus,
  PaymentMethod,
  PaymentStatus,
  PedidoEstado,
  Prisma,
} from '@prisma/client';
import { MercadoPagoOrderDetails } from '../mercado-pago/mercado-pago.types';
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
    const service = new CheckoutSnapshotProcessService();
    const itemCount = snapshot && 'items' in snapshot ? snapshot.items.length : 0;
    const transaction = {
      checkoutSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
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

    return { service, prisma, transaction };
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
    expect(transaction).not.toHaveProperty('product');
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
});
