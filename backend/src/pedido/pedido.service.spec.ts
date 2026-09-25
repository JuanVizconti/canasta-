import { BadRequestException } from '@nestjs/common';
import { PedidoEstado, Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { DeliveryMethod } from './interfaces/delivery-method.enum';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { PedidoErrorCode } from './interfaces/pedido-error-code.enum';
import { PedidoService } from './pedido.service';

describe('PedidoService', () => {
  const createPedidoDto: CreatePedidoDto = {
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??=
      'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  const createService = (subtotal = '20000.00') => {
    const cartService = {
      getSubtotalForUser: jest.fn().mockResolvedValue(new Prisma.Decimal(subtotal)),
    } as unknown as CartService;

    return { service: new PedidoService(cartService), cartService };
  };

  it('creates a pending pedido with the authenticated user id and personal data', async () => {
    const { service } = createService();
    const prisma = {
      pedido: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(service.create(7, createPedidoDto)).resolves.toEqual({ id: 1 });
    expect(prisma.pedido.create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        nombre: 'Juan',
        apellido: 'Perez',
        dni: '12345678',
        telefono: '1122334455',
        estado: PedidoEstado.PENDING,
      },
    });
  });

  it('quotes delivery using the cart subtotal and Decimal calculations', async () => {
    const { service, cartService } = createService('20000.00');
    const dto: QuotePedidoDto = { deliveryMethod: DeliveryMethod.DELIVERY };

    await expect(service.quote(7, dto)).resolves.toEqual({
      subtotal: '20000.00',
      serviceFee: '500.00',
      deliveryFee: '2000.00',
      total: '22500.00',
    });
    expect(cartService.getSubtotalForUser).toHaveBeenCalledWith(7);
  });

  it('quotes pickup without a delivery fee', async () => {
    const { service } = createService('20000.00');

    await expect(
      service.quote(7, { deliveryMethod: DeliveryMethod.PICKUP }),
    ).resolves.toEqual({
      subtotal: '20000.00',
      serviceFee: '500.00',
      deliveryFee: '0.00',
      total: '20500.00',
    });
  });

  it('accepts the exact minimum purchase amount', async () => {
    const { service } = createService('10000.00');

    await expect(
      service.quote(7, { deliveryMethod: DeliveryMethod.DELIVERY }),
    ).resolves.toEqual({
      subtotal: '10000.00',
      serviceFee: '500.00',
      deliveryFee: '1000.00',
      total: '11500.00',
    });
  });

  it('rejects a subtotal below the minimum purchase, including an empty cart', async () => {
    const { service } = createService('9999.99');

    await expect(
      service.quote(7, { deliveryMethod: DeliveryMethod.PICKUP }),
    ).rejects.toMatchObject({
      response: {
        statusCode: 400,
        code: PedidoErrorCode.MINIMUM_PURCHASE_NOT_REACHED,
        message: 'El monto mínimo de compra es de $10.000',
      },
    });

    const emptyCart = createService('0');
    await expect(
      emptyCart.service.quote(7, { deliveryMethod: DeliveryMethod.PICKUP }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps decimal precision when calculating delivery fees', async () => {
    const { service } = createService('10000.05');

    await expect(
      service.quote(7, { deliveryMethod: DeliveryMethod.DELIVERY }),
    ).resolves.toEqual({
      subtotal: '10000.05',
      serviceFee: '500.00',
      deliveryFee: '1000.01',
      total: '11500.06',
    });
  });
});
