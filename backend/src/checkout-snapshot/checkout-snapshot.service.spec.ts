import { BadRequestException } from '@nestjs/common';
import { CheckoutSnapshotStatus, Prisma } from '@prisma/client';
import { CreateCheckoutSnapshotInput, CheckoutSnapshotService } from './checkout-snapshot.service';

describe('CheckoutSnapshotService', () => {
  const checkout: CreateCheckoutSnapshotInput = {
    personalInfo: {
      nombre: 'Juan',
      apellido: 'Perez',
      dni: '12345678',
      telefono: '1122334455',
    },
    delivery: {
      method: 'DELIVERY',
      address: {
        calle: 'Siempre Viva',
        numero: '123',
        localidad: 'Springfield',
        codigoPostal: '1000',
        piso: '2',
        departamento: 'B',
        especificaciones: 'Tocar timbre',
      },
    },
  };

  const cartWithItems = () => ({
    id: 12,
    items: [
      {
        id: 1,
        cartId: 12,
        productId: 4,
        cantidad: 2,
        product: {
          id: 4,
          nombre: 'Arroz',
          marca: 'Canasta',
          precio: new Prisma.Decimal('10000.00'),
          stock: 5,
        },
      },
      {
        id: 2,
        cartId: 12,
        productId: 8,
        cantidad: 1,
        product: {
          id: 8,
          nombre: 'Aceite',
          marca: 'Canasta',
          precio: new Prisma.Decimal('5000.00'),
          stock: 3,
        },
      },
    ],
  });

  const createService = (cart = cartWithItems()) => {
    const service = new CheckoutSnapshotService();
    const snapshot = {
      id: 20,
      status: CheckoutSnapshotStatus.ACTIVE,
      expiresAt: new Date('2026-10-13T18:30:00.000Z'),
      subtotal: new Prisma.Decimal('25000.00'),
      serviceFee: new Prisma.Decimal('500.00'),
      deliveryFee: new Prisma.Decimal('2500.00'),
      total: new Prisma.Decimal('28000.00'),
      items: [],
    };
    const transaction = {
      cart: { findUnique: jest.fn().mockResolvedValue(cart) },
      checkoutSnapshot: { create: jest.fn().mockResolvedValue(snapshot) },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    return { service, prisma, transaction, snapshot };
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('creates an ACTIVE snapshot with checkout data, prices, and item snapshots atomically', async () => {
    const { service, prisma, transaction, snapshot } = createService();

    await expect(service.create(7, checkout)).resolves.toEqual(snapshot);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.cart.findUnique).toHaveBeenCalledWith({
      where: { userId: 7 },
      include: { items: { include: { product: true } } },
    });
    expect(transaction.checkoutSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 7,
        status: CheckoutSnapshotStatus.ACTIVE,
        idempotencyKey: expect.any(String),
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
        items: {
          create: [
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
        },
      }),
      select: expect.any(Object),
    }));
    expect(transaction.product.updateMany).toHaveBeenCalledWith({
      where: { id: 4, stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(transaction.product.updateMany).toHaveBeenCalledWith({
      where: { id: 8, stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });
  });

  it('sets expiration exactly 30 minutes after creation time', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T18:00:00.000Z'));
    const { service, transaction } = createService();

    await service.create(7, checkout);

    const createdData = transaction.checkoutSnapshot.create.mock.calls[0][0].data;
    expect(createdData.expiresAt).toEqual(new Date('2026-10-13T18:30:00.000Z'));
    jest.useRealTimers();
  });

  it('creates a PICKUP snapshot without delivery address fields', async () => {
    const { service, transaction } = createService();

    await service.create(7, {
      ...checkout,
      delivery: { method: 'PICKUP' },
    });

    const createdData = transaction.checkoutSnapshot.create.mock.calls[0][0].data;
    expect(createdData).toMatchObject({
      deliveryMethod: 'PICKUP',
      calle: null,
      numero: null,
      localidad: null,
      codigoPostal: null,
      piso: null,
      departamento: null,
      especificaciones: null,
    });
  });

  it('rejects an empty cart without creating a snapshot or reserving stock', async () => {
    const { service, transaction } = createService({ id: 12, items: [] });

    await expect(service.create(7, checkout)).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.checkoutSnapshot.create).not.toHaveBeenCalled();
    expect(transaction.product.updateMany).not.toHaveBeenCalled();
  });

  it('rejects insufficient stock before creating a snapshot or reserving any product', async () => {
    const cart = cartWithItems();
    cart.items[1].product.stock = 0;
    const { service, transaction } = createService(cart);

    await expect(service.create(7, checkout)).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_STOCK' },
    });

    expect(transaction.checkoutSnapshot.create).not.toHaveBeenCalled();
    expect(transaction.product.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a cart with an invalid product before creating a snapshot', async () => {
    const cart = cartWithItems() as unknown as { id: number; items: Array<Record<string, unknown>> };
    cart.items[0].product = null;
    const { service, transaction } = createService(cart as never);

    await expect(service.create(7, checkout)).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.checkoutSnapshot.create).not.toHaveBeenCalled();
    expect(transaction.product.updateMany).not.toHaveBeenCalled();
  });

  it('propagates a snapshot creation failure without reserving stock', async () => {
    const { service, prisma, transaction } = createService();
    transaction.checkoutSnapshot.create.mockRejectedValueOnce(new Error('database failure'));

    await expect(service.create(7, checkout)).rejects.toThrow('database failure');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.product.updateMany).not.toHaveBeenCalled();
  });

  it('propagates a conditional stock reservation failure', async () => {
    const { service, transaction } = createService();
    transaction.product.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.create(7, checkout)).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_STOCK' },
    });

    expect(transaction.checkoutSnapshot.create).toHaveBeenCalledTimes(1);
    expect(transaction.product.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not clear the cart or create Pedido, Payment, or Mercado Pago records', async () => {
    const { service, transaction } = createService();

    await service.create(7, checkout);

    expect(transaction).not.toHaveProperty('cartItem');
    expect(transaction.cart).not.toHaveProperty('update');
    expect(transaction).not.toHaveProperty('pedido');
    expect(transaction).not.toHaveProperty('payment');
  });

  it('marks an ACTIVE snapshot as FAILED and restores each reserved item stock', async () => {
    const service = new CheckoutSnapshotService();
    const transaction = {
      checkoutSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          status: CheckoutSnapshotStatus.ACTIVE,
          items: [
            { productId: 4, cantidad: 2 },
            { productId: 8, cantidad: 1 },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      product: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await service.markFailedAndRestoreStock(20);

    expect(transaction.checkoutSnapshot.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { status: CheckoutSnapshotStatus.FAILED },
    });
    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { stock: { increment: 2 } },
    });
    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { stock: { increment: 1 } },
    });
  });

  it('does not restore stock twice when the snapshot is already FAILED', async () => {
    const service = new CheckoutSnapshotService();
    const transaction = {
      checkoutSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          status: CheckoutSnapshotStatus.FAILED,
          items: [{ productId: 4, cantidad: 2 }],
        }),
        update: jest.fn(),
      },
      product: { update: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await service.markFailedAndRestoreStock(20);

    expect(transaction.checkoutSnapshot.update).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
  });
});
