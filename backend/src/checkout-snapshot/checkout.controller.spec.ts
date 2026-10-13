import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutController } from './checkout.controller';
import { CheckoutPaymentService } from './checkout-payment.service';

describe('CheckoutController', () => {
  const checkout = {
    personalInfo: {
      nombre: 'Juan',
      apellido: 'Perez',
      dni: '12345678',
      telefono: '1122334455',
    },
    delivery: { method: 'PICKUP' as const },
  };

  it('is protected by JwtAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CheckoutController)).toContain(JwtAuthGuard);
  });

  it('uses the authenticated user id to initialize Mercado Pago checkout', async () => {
    const checkoutPaymentService = {
      initializeMercadoPago: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://mercadopago.example/checkout/20',
      }),
    } as unknown as CheckoutPaymentService;
    const controller = new CheckoutController(checkoutPaymentService);
    const request = { user: { id: 7 } };

    await expect(controller.initializeMercadoPago(request as never, checkout))
      .resolves.toEqual({ checkoutUrl: 'https://mercadopago.example/checkout/20' });
    expect(checkoutPaymentService.initializeMercadoPago).toHaveBeenCalledWith(7, checkout);
  });
});
