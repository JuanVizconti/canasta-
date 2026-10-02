import { MercadoPagoService } from './mercado-pago.service';

describe('MercadoPagoService', () => {
  const input = {
    pedidoId: 42,
    idempotencyKey: 'idem-42',
    total: '44500.00',
    expirationTime: 'PT30M',
    payerEmail: 'juan@email.com',
  };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'test-access-token';
    process.env.FRONTEND_URL = 'https://frontend.example';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    delete process.env.FRONTEND_URL;
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
      total_amount: '44500.00',
      expiration_time: 'PT30M',
      payer: { email: 'juan@email.com' },
      config: {
        online: {
          success_url: 'https://frontend.example/pedidos/42',
          failure_url: 'https://frontend.example/pedidos/42',
          pending_url: 'https://frontend.example/pedidos/42',
          auto_return: 'all',
        },
      },
    });
  });

  it('normalizes a trailing slash in FRONTEND_URL for all return URLs', async () => {
    process.env.FRONTEND_URL = 'https://frontend.example/';
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

    await service.createOrder(input);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).config.online).toEqual({
      success_url: 'https://frontend.example/pedidos/42',
      failure_url: 'https://frontend.example/pedidos/42',
      pending_url: 'https://frontend.example/pedidos/42',
      auto_return: 'all',
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

  it('fails clearly when FRONTEND_URL is missing without creating an order', async () => {
    delete process.env.FRONTEND_URL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new MercadoPagoService();

    await expect(service.createOrder(input)).rejects.toThrow(
      'FRONTEND_URL is required',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('finds an existing order through its stable external reference', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{
          id: 'mp-order-42',
          checkout_url: 'https://mercadopago.example/checkout/42',
        }],
      }),
    });
    global.fetch = fetchMock;
    const service = new MercadoPagoService();

    await expect(service.findOrderByExternalReference({
      pedidoId: 42,
      beginDate: new Date('2026-10-01T13:00:00.000Z'),
      endDate: new Date('2026-10-01T13:30:00.000Z'),
    })).resolves.toEqual({
      providerOrderId: 'mp-order-42',
      checkoutUrl: 'https://mercadopago.example/checkout/42',
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://api.mercadopago.com/v1/orders');
    expect(url.searchParams.get('begin_date')).toBe('2026-10-01T13:00:00.000Z');
    expect(url.searchParams.get('end_date')).toBe('2026-10-01T13:30:00.000Z');
    expect(url.searchParams.get('external_reference')).toBe('42');
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer test-access-token' },
    }));
  });

  it('returns null when no order matches the external reference', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: [] }),
    });
    const service = new MercadoPagoService();

    await expect(service.findOrderByExternalReference({
      pedidoId: 42,
      beginDate: new Date('2026-10-01T13:00:00.000Z'),
      endDate: new Date('2026-10-01T13:30:00.000Z'),
    })).resolves.toBeNull();
  });

  it('rejects order-search HTTP failures without exposing the access token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const service = new MercadoPagoService();

    await expect(service.findOrderByExternalReference({
      pedidoId: 42,
      beginDate: new Date('2026-10-01T13:00:00.000Z'),
      endDate: new Date('2026-10-01T13:30:00.000Z'),
    })).rejects.toThrow('Mercado Pago order search failed with status 500');
  });
});
