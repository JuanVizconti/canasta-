import { CheckoutSnapshotStatus, Prisma } from '@prisma/client';
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import { CheckoutPaymentService } from './checkout-payment.service';
import { CheckoutSnapshotService, CreateCheckoutSnapshotInput } from './checkout-snapshot.service';

describe('CheckoutPaymentService', () => {
  const checkout: CreateCheckoutSnapshotInput = {
    personalInfo: {
      nombre: 'Juan',
      apellido: 'Perez',
      dni: '12345678',
      telefono: '1122334455',
    },
    delivery: { method: 'PICKUP' },
  };

  const snapshot = {
    id: 20,
    status: CheckoutSnapshotStatus.ACTIVE,
    idempotencyKey: 'snapshot-idempotency-key',
    expiresAt: new Date('2026-10-13T18:30:00.000Z'),
    subtotal: new Prisma.Decimal('20000.00'),
    serviceFee: new Prisma.Decimal('500.00'),
    deliveryFee: new Prisma.Decimal('0.00'),
    total: new Prisma.Decimal('20500.00'),
    user: { email: 'juan@email.com' },
    items: [],
  };

  const createService = () => {
    const checkoutSnapshotService = {
      create: jest.fn().mockResolvedValue(snapshot),
      saveMercadoPagoOrder: jest.fn().mockResolvedValue(undefined),
      markFailedAndRestoreStock: jest.fn().mockResolvedValue(undefined),
    } as unknown as CheckoutSnapshotService;
    const mercadoPagoService = {
      createOrder: jest.fn().mockResolvedValue({
        providerOrderId: 'mp-order-20',
        checkoutUrl: 'https://mercadopago.example/checkout/20',
      }),
    } as unknown as MercadoPagoService;

    return {
      service: new CheckoutPaymentService(checkoutSnapshotService, mercadoPagoService),
      checkoutSnapshotService,
      mercadoPagoService,
    };
  };

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://frontend.example';
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T18:00:00.000Z'));
  });

  afterEach(() => {
    delete process.env.FRONTEND_URL;
    jest.useRealTimers();
  });

  it('creates a snapshot before initializing Mercado Pago and returns only checkoutUrl', async () => {
    const { service, checkoutSnapshotService, mercadoPagoService } = createService();
    const calls: string[] = [];
    jest.spyOn(checkoutSnapshotService, 'create').mockImplementation(async () => {
      calls.push('snapshot');
      return snapshot;
    });
    jest.spyOn(mercadoPagoService, 'createOrder').mockImplementation(async () => {
      calls.push('mercado-pago');
      return {
        providerOrderId: 'mp-order-20',
        checkoutUrl: 'https://mercadopago.example/checkout/20',
      };
    });

    await expect(service.initializeMercadoPago(7, checkout)).resolves.toEqual({
      checkoutUrl: 'https://mercadopago.example/checkout/20',
    });

    expect(calls).toEqual(['snapshot', 'mercado-pago']);
    expect(checkoutSnapshotService.create).toHaveBeenCalledWith(7, checkout);
    expect(mercadoPagoService.createOrder).toHaveBeenCalledWith({
      externalReference: '20',
      idempotencyKey: 'snapshot-idempotency-key',
      total: '20500.00',
      expirationTime: 'PT30M',
      payerEmail: 'juan@email.com',
      returnUrl: 'https://frontend.example/checkout/success?snapshotId=20',
    });
    expect(checkoutSnapshotService.saveMercadoPagoOrder).toHaveBeenCalledWith(
      20,
      'mp-order-20',
      'https://mercadopago.example/checkout/20',
    );
    expect(checkoutSnapshotService.markFailedAndRestoreStock).not.toHaveBeenCalled();
  });

  it('compensates the ACTIVE snapshot when Mercado Pago order creation fails', async () => {
    const { service, checkoutSnapshotService, mercadoPagoService } = createService();
    jest.spyOn(mercadoPagoService, 'createOrder').mockRejectedValue(new Error('provider unavailable'));

    await expect(service.initializeMercadoPago(7, checkout)).rejects.toThrow('provider unavailable');

    expect(checkoutSnapshotService.markFailedAndRestoreStock).toHaveBeenCalledWith(20);
    expect(checkoutSnapshotService.saveMercadoPagoOrder).not.toHaveBeenCalled();
  });

  it('does not call Mercado Pago when snapshot creation fails', async () => {
    const { service, checkoutSnapshotService, mercadoPagoService } = createService();
    jest.spyOn(checkoutSnapshotService, 'create').mockRejectedValue(new Error('stock unavailable'));

    await expect(service.initializeMercadoPago(7, checkout)).rejects.toThrow('stock unavailable');

    expect(mercadoPagoService.createOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotService.markFailedAndRestoreStock).not.toHaveBeenCalled();
  });

  it('does not compensate stock when persisting Mercado Pago metadata fails', async () => {
    const { service, checkoutSnapshotService } = createService();
    jest.spyOn(checkoutSnapshotService, 'saveMercadoPagoOrder')
      .mockRejectedValue(new Error('database failure'));

    await expect(service.initializeMercadoPago(7, checkout)).rejects.toThrow('database failure');

    expect(checkoutSnapshotService.markFailedAndRestoreStock).not.toHaveBeenCalled();
  });
});
