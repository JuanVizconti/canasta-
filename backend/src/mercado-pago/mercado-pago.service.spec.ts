import { MercadoPagoService } from './mercado-pago.service';

describe('MercadoPagoService', () => {
  const input = {
    pedidoId: 42,
    idempotencyKey: 'idem-42',
    total: '44500.00',
    expirationTime: 'PT30M',
    payerEmail: 'juan@email.com',
    items: [{ title: 'Arroz', unitPrice: '20000.00', quantity: 2 }],
  };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'test-access-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  });

  it('creates an order with the expected endpoint, headers and snapshot data', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({
        id: 'mp-order-42',
        checkout_url: 'https://mercadopago.example/checkout/42',
      }),
    });
    global.fetch = fetchMock;
    const service = new MercadoPagoService();

    await expect(service.createOrder(input)).resolves.toEqual({
      providerOrderId: 'mp-order-42',
      checkoutUrl: 'https://mercadopago.example/checkout/42',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/orders',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json',
          'X-Idempotency-Key': 'idem-42',
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      type: 'online',
      processing_mode: 'manual',
      external_reference: '42',
      total_amount: 44500,
      expiration_time: 'PT30M',
      payer: { email: 'juan@email.com' },
      items: [{
        title: 'Arroz',
        unit_price: 20000,
        quantity: 2,
        unit_measure: 'unit',
        total_amount: 40000,
      }],
    });
  });

  it('rejects provider HTTP failures without exposing the access token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const service = new MercadoPagoService();

    await expect(service.createOrder(input)).rejects.toThrow(
      'Mercado Pago order creation failed with status 500',
    );
  });

  it('propagates network or timeout failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network timeout'));
    const service = new MercadoPagoService();

    await expect(service.createOrder(input)).rejects.toThrow('network timeout');
  });

  it('rejects incomplete successful responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ id: 'mp-order-42' }),
    });
    const service = new MercadoPagoService();

    await expect(service.createOrder(input)).rejects.toThrow(
      'Mercado Pago order response is missing id or checkout_url',
    );
  });

  it('fails clearly when the access token is missing', async () => {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const service = new MercadoPagoService();

    await expect(service.createOrder(input)).rejects.toThrow(
      'MERCADO_PAGO_ACCESS_TOKEN is required',
    );
  });
});
