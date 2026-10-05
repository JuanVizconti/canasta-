import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { MercadoPagoController } from './mercado-pago.controller';
import { MercadoPagoService } from './mercado-pago.service';

describe('MercadoPagoController', () => {
  let controller: MercadoPagoController;
  let mercadoPagoService: jest.Mocked<
    Pick<
      MercadoPagoService,
      'validateWebhookSignature' | 'getWebhookDataId' | 'getOrderById'
    >
  >;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    mercadoPagoService = {
      validateWebhookSignature: jest.fn(),
      getWebhookDataId: jest.fn(),
      getOrderById: jest.fn(),
    };
    controller = new MercadoPagoController(
      mercadoPagoService as unknown as MercadoPagoService,
    );
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('fetches the remote order after a valid public webhook signature', async () => {
    const body = { action: 'payment.updated', data: { id: 'mp-order-42' } };
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue('mp-order-42');
    mercadoPagoService.getOrderById.mockResolvedValue({
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status: 'processed',
      statusDetail: 'accredited',
    });

    await expect(controller.webhook(body, {}, 'signature', 'request-42')).resolves.toEqual({
      received: true,
    });
    expect(mercadoPagoService.getOrderById).toHaveBeenCalledWith('mp-order-42');
    expect(logSpy).toHaveBeenCalledWith('Mercado Pago order fetched');
  });

  it('rejects an invalid signature without fetching the remote order', async () => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(false);

    await expect(controller.webhook(
      { data: { id: 'mp-order-42' } },
      {},
      'invalid-signature',
      'request-42',
    )).rejects.toThrow(UnauthorizedException);

    expect(mercadoPagoService.getOrderById).not.toHaveBeenCalled();
  });

  it('rejects a validly signed webhook without data.id', async () => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue(undefined);

    await expect(controller.webhook({}, {}, 'signature', 'request-42'))
      .rejects.toThrow(BadRequestException);

    expect(mercadoPagoService.getOrderById).not.toHaveBeenCalled();
  });

  it('propagates remote order failures instead of acknowledging the webhook', async () => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue('mp-order-42');
    mercadoPagoService.getOrderById.mockRejectedValue(new Error('provider unavailable'));

    await expect(controller.webhook(
      { data: { id: 'mp-order-42' } },
      {},
      'signature',
      'request-42',
    )).rejects.toThrow('provider unavailable');
  });
});
