import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CheckoutSnapshotProcessService } from '../checkout-snapshot/checkout-snapshot-process.service';
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
  let checkoutSnapshotProcessService: jest.Mocked<
    Pick<
      CheckoutSnapshotProcessService,
      | 'processApprovedOrder'
      | 'processCancelledOrder'
      | 'processRefundedOrder'
    >
  >;

  beforeEach(() => {
    mercadoPagoService = {
      validateWebhookSignature: jest.fn(),
      getWebhookDataId: jest.fn(),
      getOrderById: jest.fn(),
    };
    checkoutSnapshotProcessService = {
      processApprovedOrder: jest.fn(),
      processCancelledOrder: jest.fn(),
      processRefundedOrder: jest.fn(),
    };
    controller = new MercadoPagoController(
      mercadoPagoService as unknown as MercadoPagoService,
      checkoutSnapshotProcessService as unknown as CheckoutSnapshotProcessService,
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
    expect(checkoutSnapshotProcessService.processApprovedOrder).toHaveBeenCalledWith({
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status: 'processed',
      statusDetail: 'accredited',
    });
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
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
    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });

  it('rejects a validly signed webhook without data.id', async () => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue(undefined);

    await expect(controller.webhook({}, {}, 'signature', 'request-42'))
      .rejects.toThrow(BadRequestException);

    expect(mercadoPagoService.getOrderById).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
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
    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });

  it('propagates processing failures instead of acknowledging the webhook', async () => {
    const order = {
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status: 'processed',
      statusDetail: 'accredited',
    };
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue('mp-order-42');
    mercadoPagoService.getOrderById.mockResolvedValue(order);
    checkoutSnapshotProcessService.processApprovedOrder.mockRejectedValue(
      new Error('incompatible state'),
    );

    await expect(controller.webhook(
      { data: { id: 'mp-order-42' } },
      {},
      'signature',
      'request-42',
    )).rejects.toThrow('incompatible state');
  });

  it('processes a cancelled order through the checkout snapshot processor', async () => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue('mp-order-42');
    mercadoPagoService.getOrderById.mockResolvedValue({
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status: 'canceled',
      statusDetail: 'canceled',
    });

    await expect(controller.webhook(
      { data: { id: 'mp-order-42' } },
      {},
      'signature',
      'request-42',
    )).resolves.toEqual({ received: true });

    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).toHaveBeenCalledWith({
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status: 'canceled',
      statusDetail: 'canceled',
    });
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['refunded', 'refunded'],
    ['processed', 'refunded'],
  ])('processes a refunded %s/%s order through the checkout snapshot processor', async (status, statusDetail) => {
    const order = {
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status,
      statusDetail,
    };
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue('mp-order-42');
    mercadoPagoService.getOrderById.mockResolvedValue(order);

    await expect(controller.webhook(
      { data: { id: 'mp-order-42' } },
      {},
      'signature',
      'request-42',
    )).resolves.toEqual({ received: true });

    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).toHaveBeenCalledWith(order);
  });

  it.each([
    ['processed', 'partially_refunded'],
    ['created', 'created'],
  ])('does not process a %s/%s webhook yet', async (status, statusDetail) => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getWebhookDataId.mockReturnValue('mp-order-42');
    mercadoPagoService.getOrderById.mockResolvedValue({
      providerOrderId: 'mp-order-42',
      externalReference: '42',
      status,
      statusDetail,
    });

    await expect(controller.webhook(
      { data: { id: 'mp-order-42' } },
      {},
      'signature',
      'request-42',
    )).resolves.toEqual({ received: true });

    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });
});
