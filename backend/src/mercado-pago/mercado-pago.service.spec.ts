import { createHmac } from 'node:crypto';
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
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'webhook-test-secret';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    delete process.env.FRONTEND_URL;
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
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

  describe('getOrderById', () => {
    const orderId = 'mp-order-42';

    it('gets and maps an order without sending a body or idempotency key', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: orderId,
          external_reference: '42',
          status: 'processed',
          status_detail: 'accredited',
        }),
      });
      global.fetch = fetchMock;
      const service = new MercadoPagoService();

      await expect(service.getOrderById(orderId)).resolves.toEqual({
        providerOrderId: orderId,
        externalReference: '42',
        status: 'processed',
        statusDetail: 'accredited',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/orders/mp-order-42',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer test-access-token' },
          signal: expect.anything(),
        }),
      );
      const request = fetchMock.mock.calls[0][1];
      expect(request.body).toBeUndefined();
      expect(request.headers['X-Idempotency-Key']).toBeUndefined();
    });

    it('uses the existing request timeout', async () => {
      const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: orderId,
          external_reference: '42',
          status: 'processed',
        }),
      });
      const service = new MercadoPagoService();

      await service.getOrderById(orderId);

      expect(timeoutSpy).toHaveBeenCalledWith(10_000);
      timeoutSpy.mockRestore();
    });

    it('maps an absent or null status_detail to null', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: orderId,
          external_reference: '42',
          status: 'processed',
          status_detail: null,
        }),
      });
      const service = new MercadoPagoService();

      await expect(service.getOrderById(orderId)).resolves.toMatchObject({
        statusDetail: null,
      });
    });

    it.each([
      ['id', { external_reference: '42', status: 'processed' }],
      ['external_reference', { id: orderId, status: 'processed' }],
      ['status', { id: orderId, external_reference: '42' }],
    ])('rejects a successful response without %s', async (_field, response) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(response),
      });
      const service = new MercadoPagoService();

      await expect(service.getOrderById(orderId)).rejects.toThrow(
        'Mercado Pago order details response is missing required fields',
      );
    });

    it('rejects non-successful responses without exposing the access token', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
      const service = new MercadoPagoService();

      await expect(service.getOrderById(orderId)).rejects.toThrow(
        'Mercado Pago order fetch failed with status 404',
      );
    });

    it('fails clearly without an access token before making a request', async () => {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const service = new MercadoPagoService();

      await expect(service.getOrderById(orderId)).rejects.toThrow(
        'MERCADO_PAGO_ACCESS_TOKEN is required',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('validateWebhookSignature', () => {
    const webhookSecret = 'webhook-test-secret';
    const requestId = 'request-42';
    const timestamp = '1729623876';
    const dataId = 'ORDTST01ABC123XYZ';

    const createSignature = (id = dataId, normalizeId = true) => {
      const manifestId = normalizeId ? id.toLowerCase() : id;
      const manifest = `id:${manifestId};request-id:${requestId};ts:${timestamp};`;
      const hash = createHmac('sha256', webhookSecret).update(manifest).digest('hex');

      return `v1=${hash}, ts=${timestamp}`;
    };

    it('normalizes data.id to lowercase in the signature manifest', () => {
      const service = new MercadoPagoService();

      expect(service.validateWebhookSignature(
        { data: { id: dataId } },
        {},
        createSignature(),
        requestId,
      )).toBe(true);
    });

    it('rejects a signature calculated with the original data.id case', () => {
      const service = new MercadoPagoService();

      expect(service.validateWebhookSignature(
        { data: { id: dataId } },
        {},
        createSignature(dataId, false),
        requestId,
      )).toBe(false);
    });

    it('uses data.id from the query when it is present', () => {
      const service = new MercadoPagoService();

      expect(service.validateWebhookSignature(
        { data: { id: 'body-payment' } },
        { 'data.id': dataId },
        createSignature(),
        requestId,
      )).toBe(true);
    });

    it('rejects a webhook without data.id', () => {
      const service = new MercadoPagoService();

      expect(service.validateWebhookSignature(
        { data: {} },
        {},
        createSignature(),
        requestId,
      )).toBe(false);
    });

    it.each([
      ['missing signature', undefined, requestId],
      ['missing request id', createSignature(), undefined],
      ['missing timestamp', `v1=${'0'.repeat(64)}`, requestId],
      ['missing v1', `ts=${timestamp}`, requestId],
      ['invalid signature', `ts=${timestamp},v1=${'0'.repeat(64)}`, requestId],
      ['hash with a different length', `ts=${timestamp},v1=abc`, requestId],
    ])('rejects a %s', (_description, signature, currentRequestId) => {
      const service = new MercadoPagoService();

      expect(service.validateWebhookSignature(
        { data: { id: dataId } },
        {},
        signature,
        currentRequestId,
      )).toBe(false);
    });

    it('fails clearly when the webhook secret is missing', () => {
      delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
      const service = new MercadoPagoService();

      expect(() => service.validateWebhookSignature(
        { data: { id: dataId } },
        {},
        createSignature(),
        requestId,
      )).toThrow('MERCADO_PAGO_WEBHOOK_SECRET is required');
    });
  });
});
