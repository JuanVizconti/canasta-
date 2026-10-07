import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, PedidoEstado, Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import { MercadoPagoOrderDetails } from '../mercado-pago/mercado-pago.types';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { DeliveryMethod } from './interfaces/delivery-method.enum';
import { PedidoErrorCode } from './interfaces/pedido-error-code.enum';
import { PedidoService } from './pedido.service';
import { MercadoPagoOrderProcessService } from './mercado-pago-order-process.service';

describe('PedidoService', () => {
  const createPedidoDto: CreatePedidoDto = {
    personalInfo: {
      nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455',
    },
    delivery: {
      method: DeliveryMethod.DELIVERY,
      address: {
        calle: 'Siempre Viva', numero: '123', localidad: 'Springfield', codigoPostal: '1000', piso: '2',
      },
    },
    paymentMethod: PaymentMethod.CASH,
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  const createService = (subtotal = '20000.00') => {
    const cartService = {
      getSubtotalForUser: jest.fn().mockResolvedValue(new Prisma.Decimal(subtotal)),
    } as unknown as CartService;
    const mercadoPagoService = {
      createOrder: jest.fn().mockResolvedValue({
        providerOrderId: 'mp-order-27',
        checkoutUrl: 'https://mercadopago.example/checkout/27',
      }),
    } as unknown as MercadoPagoService;
    const mercadoPagoOrderProcessService = {
      process: jest.fn().mockResolvedValue(undefined),
    } as unknown as MercadoPagoOrderProcessService;
    return {
      service: new PedidoService(
        cartService,
        mercadoPagoService,
        mercadoPagoOrderProcessService,
      ),
      cartService,
      mercadoPagoService,
      mercadoPagoOrderProcessService,
    };
  };

  const cartWithProduct = (price = '20000.00') => ({
    id: 12,
    items: [{
      id: 8, cartId: 12, productId: 4, cantidad: 2,
      product: { id: 4, nombre: 'Arroz', marca: 'Canasta', precio: new Prisma.Decimal(price), stock: 5 },
    }],
  });

  const configureTransaction = (
    service: PedidoService,
    cart = cartWithProduct(),
    updatedProducts = 1,
    pedidoResult = {
      id: 27, estado: PedidoEstado.CONFIRMED, total: new Prisma.Decimal('44500.00'),
      payment: { method: PaymentMethod.CASH, status: PaymentStatus.PENDING },
    },
  ) => {
    const transaction = {
      cart: { findUnique: jest.fn().mockResolvedValue(cart), update: jest.fn().mockResolvedValue({}) },
      product: { updateMany: jest.fn().mockResolvedValue({ count: updatedProducts }) },
      pedido: {
        create: jest.fn().mockResolvedValue(pedidoResult),
      },
      cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
      payment: { update: jest.fn().mockResolvedValue({}) },
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;
    return { prisma, transaction };
  };

  const retryPedido = (overrides: Record<string, unknown> = {}) => ({
    id: 42,
    estado: PedidoEstado.PENDING,
    total: new Prisma.Decimal('44500.00'),
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    user: { email: 'juan@email.com' },
    payment: {
      method: PaymentMethod.MERCADO_PAGO,
      status: PaymentStatus.PENDING,
      idempotencyKey: 'persisted-idempotency-key',
      providerOrderId: null,
      checkoutUrl: null,
    },
    ...overrides,
  });

  const configureRetryPrisma = (service: PedidoService, pedido = retryPedido()) => {
    const prisma = {
      pedido: {
        findFirst: jest.fn().mockResolvedValue(pedido),
        create: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;
    return prisma;
  };

  const approvedOrder = (
    overrides: Partial<MercadoPagoOrderDetails> = {},
  ): MercadoPagoOrderDetails => ({
    providerOrderId: 'mp-order-approved',
    externalReference: '24',
    status: 'processed',
    statusDetail: 'accredited',
    ...overrides,
  });

  it('creates a confirmed CASH pedido from the real cart and clears that cart atomically', async () => {
    const { service } = createService();
    const { prisma, transaction } = configureTransaction(service);

    await expect(service.create(7, createPedidoDto)).resolves.toEqual({
      id: 27, estado: PedidoEstado.CONFIRMED, total: '44500.00',
      payment: { method: PaymentMethod.CASH, status: 'PENDING' },
    });

    expect(transaction.cart.findUnique).toHaveBeenCalledWith({
      where: { userId: 7 }, include: { items: { include: { product: true } } },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.product.updateMany).toHaveBeenCalledWith({
      where: { id: 4, stock: { gte: 2 } }, data: { stock: { decrement: 2 } },
    });
    expect(transaction.pedido.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 7, estado: PedidoEstado.CONFIRMED,
        subtotal: new Prisma.Decimal('40000.00'), serviceFee: new Prisma.Decimal('500'),
        deliveryFee: new Prisma.Decimal('4000.00'), total: new Prisma.Decimal('44500.00'),
        items: { create: [expect.objectContaining({
          productId: 4, nombre: 'Arroz', marca: 'Canasta', cantidad: 2, unitPrice: new Prisma.Decimal('20000.00'),
        })] },
        payment: { create: { method: PaymentMethod.CASH, status: 'PENDING', providerOrderId: null } },
      }),
    }));
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 12 } });
    expect(transaction.cart.update).toHaveBeenCalledWith({
      where: { id: 12 }, data: { price: new Prisma.Decimal(0) },
    });
  });

  it('recalculates prices from current products instead of trusting frontend values', async () => {
    const { service } = createService();
    const { transaction } = configureTransaction(service, cartWithProduct('6000.00'));

    await service.create(7, { ...createPedidoDto, delivery: { method: DeliveryMethod.PICKUP } });

    expect(transaction.pedido.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subtotal: new Prisma.Decimal('12000.00'), deliveryFee: new Prisma.Decimal(0), total: new Prisma.Decimal('12500.00'),
      }),
    }));
  });

  it('creates a pending MERCADO_PAGO pedido, reserves stock and initializes the provider order after commit', async () => {
    const { service, mercadoPagoService } = createService();
    const pendingPedido = {
      id: 42,
      estado: PedidoEstado.PENDING,
      total: new Prisma.Decimal('44500.00'),
      user: { email: 'juan@email.com' },
      items: [{ nombre: 'Arroz', marca: 'Canasta', cantidad: 2, unitPrice: new Prisma.Decimal('20000.00') }],
      payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.PENDING, idempotencyKey: 'key-42' },
    };
    const { prisma, transaction } = configureTransaction(service, cartWithProduct(), 1, pendingPedido);

    await expect(service.create(7, { ...createPedidoDto, paymentMethod: PaymentMethod.MERCADO_PAGO }))
      .resolves.toEqual({
        id: 42,
        estado: PedidoEstado.PENDING,
        total: '44500.00',
        payment: {
          method: PaymentMethod.MERCADO_PAGO,
          status: PaymentStatus.PENDING,
          checkoutUrl: 'https://mercadopago.example/checkout/27',
        },
        paymentInitialization: { status: 'READY' },
      });

    const createdData = transaction.pedido.create.mock.calls[0][0].data;
    expect(createdData).toEqual(expect.objectContaining({
      estado: PedidoEstado.PENDING,
      expiresAt: expect.any(Date),
      payment: {
        create: expect.objectContaining({
          method: PaymentMethod.MERCADO_PAGO,
          status: PaymentStatus.PENDING,
          providerOrderId: null,
          checkoutUrl: null,
          idempotencyKey: expect.any(String),
        }),
      },
    }));
    expect(transaction.product.updateMany).toHaveBeenCalledWith({
      where: { id: 4, stock: { gte: 2 } }, data: { stock: { decrement: 2 } },
    });
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 12 } });
    expect(transaction.cart.update).toHaveBeenCalledWith({
      where: { id: 12 }, data: { price: new Prisma.Decimal(0) },
    });
    expect(mercadoPagoService.createOrder).toHaveBeenCalledWith({
      pedidoId: 42,
      idempotencyKey: 'key-42',
      total: '44500.00',
      expirationTime: 'PT30M',
      payerEmail: 'juan@email.com',
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 42 },
      data: {
        providerOrderId: 'mp-order-27',
        checkoutUrl: 'https://mercadopago.example/checkout/27',
      },
    });
  });

  it('rolls back the local transaction and does not call Mercado Pago when stock is insufficient', async () => {
    const { service, mercadoPagoService } = createService();
    const pendingPedido = {
      id: 42, estado: PedidoEstado.PENDING, total: new Prisma.Decimal('44500.00'),
      user: { email: 'juan@email.com' }, items: [],
      payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.PENDING, idempotencyKey: 'key-42' },
    };
    const { transaction } = configureTransaction(service, cartWithProduct(), 0, pendingPedido);

    await expect(service.create(7, { ...createPedidoDto, paymentMethod: PaymentMethod.MERCADO_PAGO }))
      .rejects.toMatchObject({ response: { code: PedidoErrorCode.INSUFFICIENT_STOCK } });

    expect(transaction.pedido.create).toHaveBeenCalledTimes(1);
    expect(mercadoPagoService.createOrder).not.toHaveBeenCalled();
    expect(transaction.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps the pending pedido, reserved stock and cart when Mercado Pago fails after commit', async () => {
    const { service, mercadoPagoService } = createService();
    const pendingPedido = {
      id: 42,
      estado: PedidoEstado.PENDING,
      total: new Prisma.Decimal('44500.00'),
      user: { email: 'juan@email.com' },
      items: [{ nombre: 'Arroz', marca: 'Canasta', cantidad: 2, unitPrice: new Prisma.Decimal('20000.00') }],
      payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.PENDING, idempotencyKey: 'key-42' },
    };
    const { prisma, transaction } = configureTransaction(service, cartWithProduct(), 1, pendingPedido);
    jest.spyOn(mercadoPagoService, 'createOrder').mockRejectedValue(new Error('provider unavailable'));

    await expect(service.create(7, { ...createPedidoDto, paymentMethod: PaymentMethod.MERCADO_PAGO }))
      .resolves.toEqual({
        id: 42,
        estado: PedidoEstado.PENDING,
        total: '44500.00',
        payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.PENDING, checkoutUrl: null },
        paymentInitialization: { status: 'FAILED' },
      });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 12 } });
    expect(transaction.cart.update).toHaveBeenCalledWith({
      where: { id: 12 }, data: { price: new Prisma.Decimal(0) },
    });
  });

  it('does not create anything when the subtotal is below the minimum', async () => {
    const { service } = createService();
    const { transaction } = configureTransaction(service, cartWithProduct('4999.99'));

    await expect(service.create(7, createPedidoDto))
      .rejects.toMatchObject({ response: { code: PedidoErrorCode.MINIMUM_PURCHASE_NOT_REACHED } });
    expect(transaction.product.updateMany).not.toHaveBeenCalled();
    expect(transaction.pedido.create).not.toHaveBeenCalled();
    expect(transaction.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects the transaction and does not clear the cart when conditional stock decrement fails', async () => {
    const { service } = createService();
    const { prisma, transaction } = configureTransaction(service, cartWithProduct(), 0);

    await expect(service.create(7, createPedidoDto))
      .rejects.toMatchObject({ response: { code: PedidoErrorCode.INSUFFICIENT_STOCK } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.pedido.create).toHaveBeenCalledTimes(1);
    expect(transaction.product.updateMany).toHaveBeenCalledWith({
      where: { id: 4, stock: { gte: 2 } }, data: { stock: { decrement: 2 } },
    });
    expect(transaction.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(transaction.cart.update).not.toHaveBeenCalled();
  });

  it('finds a pedido only when its id and authenticated user id match', async () => {
    const { service } = createService();
    const pedido = {
      id: 27,
      userId: 7,
      nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455',
      deliveryMethod: 'PICKUP', calle: null, numero: null, localidad: null, codigoPostal: null,
      piso: null, departamento: null, especificaciones: null,
      subtotal: new Prisma.Decimal('20000'), serviceFee: new Prisma.Decimal('500'),
      deliveryFee: new Prisma.Decimal(0), total: new Prisma.Decimal('20500'),
      estado: PedidoEstado.CONFIRMED, createdAt: new Date('2026-09-28T18:30:00.000Z'),
      items: [], payment: null,
    };
    const prisma = { pedido: { findFirst: jest.fn().mockResolvedValue(pedido) } };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.findOneForUser(7, 27)).resolves.toMatchObject({
      id: 27, delivery: { method: 'PICKUP' }, payment: null,
    });
    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id: 27, userId: 7 },
      include: expect.objectContaining({ items: expect.any(Object), payment: true }),
    });
  });

  it('uses the same not-found contract for a missing or foreign pedido', async () => {
    const { service } = createService();
    const prisma = { pedido: { findFirst: jest.fn().mockResolvedValue(null) } };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.findOneForUser(7, 27)).rejects.toMatchObject({
      response: {
        statusCode: 404,
        code: PedidoErrorCode.PEDIDO_NOT_FOUND,
        message: 'Pedido no encontrado.',
      },
    });
    expect(prisma.pedido.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 27, userId: 7 },
    }));
  });

  it('lists only the authenticated user pedido summaries from newest to oldest', async () => {
    const { service } = createService();
    const pedidos = [
      {
        id: 42,
        createdAt: new Date('2026-10-07T20:15:00.000Z'),
        total: new Prisma.Decimal('12500'),
        estado: PedidoEstado.CONFIRMED,
      },
      {
        id: 41,
        createdAt: new Date('2026-10-06T18:10:00.000Z'),
        total: new Prisma.Decimal('10000'),
        estado: PedidoEstado.CANCELLED,
      },
    ];
    const prisma = {
      pedido: { findMany: jest.fn().mockResolvedValue(pedidos) },
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.findAllByUser(7)).resolves.toEqual([
      {
        id: 42,
        createdAt: new Date('2026-10-07T20:15:00.000Z'),
        total: '12500.00',
        estado: PedidoEstado.CONFIRMED,
      },
      {
        id: 41,
        createdAt: new Date('2026-10-06T18:10:00.000Z'),
        total: '10000.00',
        estado: PedidoEstado.CANCELLED,
      },
    ]);
    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      select: {
        id: true,
        createdAt: true,
        total: true,
        estado: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns an empty pedido history when the authenticated user has no pedidos', async () => {
    const { service } = createService();
    const prisma = {
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.findAllByUser(7)).resolves.toEqual([]);
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 7 },
    }));
  });

  it('uses the same not-found contract for a missing or foreign pedido payment retry', async () => {
    const { service, mercadoPagoService } = createService();
    const prisma = configureRetryPrisma(service, null);

    await expect(service.retryMercadoPagoPayment(7, 42)).rejects.toMatchObject({
      response: { statusCode: 404, code: PedidoErrorCode.PEDIDO_NOT_FOUND },
    });
    expect(prisma.pedido.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42, userId: 7 },
    }));
    expect(mercadoPagoService.createOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['pedido is not pending', retryPedido({ estado: PedidoEstado.CONFIRMED })],
    ['payment is missing', retryPedido({ payment: null })],
    ['payment method is CASH', retryPedido({ payment: { method: PaymentMethod.CASH, status: PaymentStatus.PENDING, idempotencyKey: 'key', providerOrderId: null, checkoutUrl: null } })],
    ['payment status is not pending', retryPedido({ payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.APPROVED, idempotencyKey: 'key', providerOrderId: null, checkoutUrl: null } })],
    ['idempotency key is missing', retryPedido({ payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.PENDING, idempotencyKey: null, providerOrderId: null, checkoutUrl: null } })],
    ['expiration is missing', retryPedido({ expiresAt: null })],
  ])('does not allow payment retry when %s', async (_description, pedido) => {
    const { service, mercadoPagoService } = createService();
    const prisma = configureRetryPrisma(service, pedido);

    await expect(service.retryMercadoPagoPayment(7, 42)).rejects.toMatchObject({
      response: { code: PedidoErrorCode.PAYMENT_RETRY_NOT_ALLOWED },
    });
    expect(mercadoPagoService.createOrder).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not call Mercado Pago when the pending pedido is expired', async () => {
    const { service, mercadoPagoService } = createService();
    const prisma = configureRetryPrisma(service, retryPedido({ expiresAt: new Date(Date.now() - 1) }));

    await expect(service.retryMercadoPagoPayment(7, 42)).rejects.toMatchObject({
      response: { code: PedidoErrorCode.PAYMENT_EXPIRED },
    });
    expect(mercadoPagoService.createOrder).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('returns an existing checkout URL without calling Mercado Pago again', async () => {
    const { service, mercadoPagoService } = createService();
    const prisma = configureRetryPrisma(service, retryPedido({
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.PENDING,
        idempotencyKey: 'persisted-idempotency-key',
        providerOrderId: 'mp-order-42',
        checkoutUrl: 'https://mercadopago.example/checkout/42',
      },
    }));

    await expect(service.retryMercadoPagoPayment(7, 42)).resolves.toEqual({
      id: 42,
      estado: PedidoEstado.PENDING,
      total: '44500.00',
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.PENDING,
        checkoutUrl: 'https://mercadopago.example/checkout/42',
      },
      paymentInitialization: { status: 'READY' },
    });
    expect(mercadoPagoService.createOrder).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('uses a new idempotency key and creates a new Mercado Pago order when checkout URL is absent', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T13:10:00.000Z'));
    const { service, mercadoPagoService } = createService();
    const prisma = configureRetryPrisma(service, retryPedido({
      createdAt: new Date('2026-10-01T13:00:00.000Z'),
      expiresAt: new Date('2026-10-01T13:30:00.000Z'),
      payment: {
        method: PaymentMethod.MERCADO_PAGO,
        status: PaymentStatus.PENDING,
        idempotencyKey: 'persisted-idempotency-key',
        providerOrderId: 'mp-order-42',
        checkoutUrl: null,
      },
    }));

    await expect(service.retryMercadoPagoPayment(7, 42)).resolves.toMatchObject({
      id: 42,
      estado: PedidoEstado.PENDING,
      payment: { checkoutUrl: 'https://mercadopago.example/checkout/27' },
      paymentInitialization: { status: 'READY' },
    });

    const newIdempotencyKey = prisma.payment.update.mock.calls[0][0].data.idempotencyKey;
    expect(newIdempotencyKey).toEqual(expect.any(String));
    expect(newIdempotencyKey).not.toBe('persisted-idempotency-key');
    expect(mercadoPagoService.createOrder).toHaveBeenCalledWith({
      pedidoId: 42,
      idempotencyKey: newIdempotencyKey,
      total: '44500.00',
      expirationTime: 'PT20M',
      payerEmail: 'juan@email.com',
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 42 },
      data: { idempotencyKey: newIdempotencyKey },
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { pedidoId: 42 },
      data: {
        providerOrderId: 'mp-order-27',
        checkoutUrl: 'https://mercadopago.example/checkout/27',
      },
    });
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('keeps the retry pending, with its new key and no checkout URL, when Mercado Pago creation fails', async () => {
    const { service, mercadoPagoService } = createService();
    const prisma = configureRetryPrisma(service);
    jest.spyOn(mercadoPagoService, 'createOrder').mockRejectedValue(new Error('provider unavailable'));

    await expect(service.retryMercadoPagoPayment(7, 42)).resolves.toEqual({
      id: 42,
      estado: PedidoEstado.PENDING,
      total: '44500.00',
      payment: { method: PaymentMethod.MERCADO_PAGO, status: PaymentStatus.PENDING, checkoutUrl: null },
      paymentInitialization: { status: 'FAILED' },
    });
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update.mock.calls[0][0]).toEqual({
      where: { pedidoId: 42 },
      data: { idempotencyKey: expect.any(String) },
    });
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('delegates an approved order using its numeric external reference', async () => {
    const { service, mercadoPagoOrderProcessService } = createService();
    const order = approvedOrder();

    await expect(service.processMercadoPagoOrder(order)).resolves.toBeUndefined();

    expect(mercadoPagoOrderProcessService.process).toHaveBeenCalledWith(
      'APPROVED',
      24,
      order,
    );
  });

  it.each(['', 'abc', '24abc', '0', '-1'])
  ('rejects an invalid external reference without delegating: %s', async (externalReference) => {
    const { service, mercadoPagoOrderProcessService } = createService();

    await expect(service.processMercadoPagoOrder(approvedOrder({ externalReference })))
      .rejects.toThrow('Mercado Pago order external reference is invalid');

    expect(mercadoPagoOrderProcessService.process).not.toHaveBeenCalled();
  });

  it('does not delegate NO_ACTION or PARTIALLY_REFUNDED decisions', async () => {
    const { service, mercadoPagoOrderProcessService } = createService();

    await service.processMercadoPagoOrder(approvedOrder({
      status: 'processing',
      statusDetail: 'in_process',
    }));
    await service.processMercadoPagoOrder(approvedOrder({
      status: 'processed',
      statusDetail: 'partially_refunded',
    }));

    expect(mercadoPagoOrderProcessService.process).not.toHaveBeenCalled();
  });

  it('quotes delivery using the cart subtotal and Decimal calculations', async () => {
    const { service, cartService } = createService('20000.00');
    const dto: QuotePedidoDto = { deliveryMethod: DeliveryMethod.DELIVERY };
    await expect(service.quote(7, dto)).resolves.toEqual({
      subtotal: '20000.00', serviceFee: '500.00', deliveryFee: '2000.00', total: '22500.00',
    });
    expect(cartService.getSubtotalForUser).toHaveBeenCalledWith(7);
  });

  it('quotes pickup without a delivery fee and accepts the exact minimum', async () => {
    const { service } = createService('10000.00');
    await expect(service.quote(7, { deliveryMethod: DeliveryMethod.PICKUP })).resolves.toEqual({
      subtotal: '10000.00', serviceFee: '500.00', deliveryFee: '0.00', total: '10500.00',
    });
  });

  it('rejects a subtotal below the minimum, including an empty cart', async () => {
    const { service } = createService('9999.99');
    await expect(service.quote(7, { deliveryMethod: DeliveryMethod.PICKUP })).rejects.toBeInstanceOf(BadRequestException);
    const emptyCart = createService('0');
    await expect(emptyCart.service.quote(7, { deliveryMethod: DeliveryMethod.PICKUP })).rejects.toBeInstanceOf(BadRequestException);
  });
});
