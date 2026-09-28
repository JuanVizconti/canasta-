import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PedidoEstado, Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { DeliveryMethod } from './interfaces/delivery-method.enum';
import { PedidoErrorCode } from './interfaces/pedido-error-code.enum';
import { PedidoService } from './pedido.service';

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
    return { service: new PedidoService(cartService), cartService };
  };

  const cartWithProduct = (price = '20000.00') => ({
    id: 12,
    items: [{
      id: 8, cartId: 12, productId: 4, cantidad: 2,
      product: { id: 4, nombre: 'Arroz', marca: 'Canasta', precio: new Prisma.Decimal(price), stock: 5 },
    }],
  });

  const configureTransaction = (service: PedidoService, cart = cartWithProduct(), updatedProducts = 1) => {
    const transaction = {
      cart: { findUnique: jest.fn().mockResolvedValue(cart), update: jest.fn().mockResolvedValue({}) },
      product: { updateMany: jest.fn().mockResolvedValue({ count: updatedProducts }) },
      pedido: {
        create: jest.fn().mockResolvedValue({
          id: 27, estado: PedidoEstado.CONFIRMED, total: new Prisma.Decimal('44500.00'),
          payment: { method: PaymentMethod.CASH, status: 'PENDING' },
        }),
      },
      cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;
    return { prisma, transaction };
  };

  it('creates a confirmed CASH pedido from the real cart and clears that cart atomically', async () => {
    const { service } = createService();
    const { transaction } = configureTransaction(service);

    await expect(service.create(7, createPedidoDto)).resolves.toEqual({
      id: 27, estado: PedidoEstado.CONFIRMED, total: '44500.00',
      payment: { method: PaymentMethod.CASH, status: 'PENDING' },
    });

    expect(transaction.cart.findUnique).toHaveBeenCalledWith({
      where: { userId: 7 }, include: { items: { include: { product: true } } },
    });
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

  it('rejects MERCADO_PAGO without entering the CASH transaction', async () => {
    const { service } = createService();
    const { prisma } = configureTransaction(service);

    await expect(service.create(7, { ...createPedidoDto, paymentMethod: PaymentMethod.MERCADO_PAGO }))
      .rejects.toMatchObject({ response: { code: PedidoErrorCode.PAYMENT_METHOD_NOT_SUPPORTED } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  it('stops the transaction path when conditional stock decrement fails', async () => {
    const { service } = createService();
    const { transaction } = configureTransaction(service, cartWithProduct(), 0);

    await expect(service.create(7, createPedidoDto))
      .rejects.toMatchObject({ response: { code: PedidoErrorCode.INSUFFICIENT_STOCK } });
    expect(transaction.pedido.create).not.toHaveBeenCalled();
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
