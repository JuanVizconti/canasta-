import { PaymentMethod } from '@prisma/client';
import { PedidoController } from './pedido.controller';
import { PedidoService } from './pedido.service';

describe('PedidoController', () => {
  const createPedidoDto = {
    personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
    delivery: { method: 'PICKUP' as const },
    paymentMethod: PaymentMethod.CASH,
  };

  it('uses the user id provided by JwtAuthGuard and delegates final pedido creation', async () => {
    const pedidoService = { create: jest.fn().mockResolvedValue({ id: 1 }) } as unknown as PedidoService;
    const controller = new PedidoController(pedidoService);
    const request = { user: { id: 7 } };

    await expect(controller.create(request as never, createPedidoDto)).resolves.toEqual({ id: 1 });
    expect(pedidoService.create).toHaveBeenCalledWith(7, createPedidoDto);
  });

  it('uses the authenticated user id and delegates quote delivery method to PedidoService', async () => {
    const quotePedidoDto = { deliveryMethod: 'DELIVERY' as const };
    const pedidoService = { quote: jest.fn().mockResolvedValue({ total: '22500.00' }) } as unknown as PedidoService;
    const controller = new PedidoController(pedidoService);
    const request = { user: { id: 7 } };

    await expect(controller.quote(request as never, quotePedidoDto)).resolves.toEqual({ total: '22500.00' });
    expect(pedidoService.quote).toHaveBeenCalledWith(7, quotePedidoDto);
  });

  it('uses the authenticated user id and parsed id to retrieve a pedido', async () => {
    const pedidoService = { findOneForUser: jest.fn().mockResolvedValue({ id: 27 }) } as unknown as PedidoService;
    const controller = new PedidoController(pedidoService);
    const request = { user: { id: 7 } };

    await expect(controller.findOne(request as never, 27)).resolves.toEqual({ id: 27 });
    expect(pedidoService.findOneForUser).toHaveBeenCalledWith(7, 27);
  });
});
