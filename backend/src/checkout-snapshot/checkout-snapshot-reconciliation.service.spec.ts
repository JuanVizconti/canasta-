import { Logger } from '@nestjs/common';
import { CheckoutSnapshotStatus } from '@prisma/client';
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import { CheckoutSnapshotProcessService } from './checkout-snapshot-process.service';
import { CheckoutSnapshotReconciliationService } from './checkout-snapshot-reconciliation.service';

describe('CheckoutSnapshotReconciliationService', () => {
  const overdueSnapshot = (overrides: Record<string, unknown> = {}) => ({
    id: 20,
    providerOrderId: 'mp-order-20',
    expiresAt: new Date('2026-10-20T10:00:00.000Z'),
    ...overrides,
  });

  const order = (overrides: Record<string, unknown> = {}) => ({
    providerOrderId: 'mp-order-20',
    externalReference: '20',
    status: 'processed',
    statusDetail: 'accredited',
    ...overrides,
  });

  const createService = (snapshots = [overdueSnapshot()]) => {
    const mercadoPagoService = {
      getOrderById: jest.fn().mockResolvedValue(order()),
    } as unknown as MercadoPagoService;
    const checkoutSnapshotProcessService = {
      processApprovedOrder: jest.fn().mockResolvedValue(undefined),
      processCancelledOrder: jest.fn().mockResolvedValue(undefined),
      processRefundedOrder: jest.fn().mockResolvedValue(undefined),
    } as unknown as CheckoutSnapshotProcessService;
    const service = new CheckoutSnapshotReconciliationService(
      mercadoPagoService,
      checkoutSnapshotProcessService,
    );
    const prisma = {
      checkoutSnapshot: {
        findMany: jest.fn().mockResolvedValue(snapshots),
      },
      $transaction: jest.fn(),
    };
    (
      service as unknown as { prisma: typeof prisma }
    ).prisma = prisma;

    return {
      service,
      prisma,
      mercadoPagoService,
      checkoutSnapshotProcessService,
    };
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads at most 100 ACTIVE snapshots whose expiration has passed', async () => {
    const { service, prisma } = createService([]);
    const before = new Date();

    await service.reconcileOverdueSnapshots();

    const query = prisma.checkoutSnapshot.findMany.mock.calls[0][0];
    expect(query.where.status).toBe(CheckoutSnapshotStatus.ACTIVE);
    expect(query.where.expiresAt.lte).toBeInstanceOf(Date);
    expect(query.where.expiresAt.lte.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(query.select).toEqual({
      id: true,
      providerOrderId: true,
      expiresAt: true,
    });
    expect(query.orderBy).toEqual({ expiresAt: 'asc' });
    expect(query.take).toBe(100);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips a snapshot without providerOrderId and continues with the next snapshot', async () => {
    const secondSnapshot = overdueSnapshot({
      id: 21,
      providerOrderId: 'mp-order-21',
    });
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService([
      overdueSnapshot({ providerOrderId: null }),
      secondSnapshot,
    ]);
    (mercadoPagoService.getOrderById as jest.Mock).mockResolvedValueOnce(order({
      providerOrderId: 'mp-order-21',
      externalReference: '21',
    }));

    await service.reconcileOverdueSnapshots();

    expect(mercadoPagoService.getOrderById).toHaveBeenCalledTimes(1);
    expect(mercadoPagoService.getOrderById).toHaveBeenCalledWith('mp-order-21');
    expect(checkoutSnapshotProcessService.processApprovedOrder).toHaveBeenCalledTimes(1);
  });

  it('delegates an approved Mercado Pago order to the process service', async () => {
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService();
    const approvedOrder = order();
    (mercadoPagoService.getOrderById as jest.Mock).mockResolvedValueOnce(approvedOrder);

    await service.reconcileOverdueSnapshots();

    expect(checkoutSnapshotProcessService.processApprovedOrder).toHaveBeenCalledWith(approvedOrder);
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });

  it('delegates a cancelled Mercado Pago order to the process service', async () => {
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService();
    const cancelledOrder = order({ status: 'canceled', statusDetail: 'canceled' });
    (mercadoPagoService.getOrderById as jest.Mock).mockResolvedValueOnce(cancelledOrder);

    await service.reconcileOverdueSnapshots();

    expect(checkoutSnapshotProcessService.processCancelledOrder).toHaveBeenCalledWith(cancelledOrder);
    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['created', 'created'],
    ['failed', 'processing_error'],
  ])('does nothing for a %s/%s order mapped to NO_ACTION', async (status, statusDetail) => {
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService();
    (mercadoPagoService.getOrderById as jest.Mock).mockResolvedValueOnce(order({ status, statusDetail }));

    await service.reconcileOverdueSnapshots();

    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['refunded', 'refunded'],
    ['processed', 'partially_refunded'],
  ])('does not process unexpected ACTIVE %s/%s refund states', async (status, statusDetail) => {
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService();
    (mercadoPagoService.getOrderById as jest.Mock).mockResolvedValueOnce(order({ status, statusDetail }));

    await service.reconcileOverdueSnapshots();

    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
  });

  it('continues processing later snapshots after Mercado Pago lookup or processor failures', async () => {
    const snapshots = [
      overdueSnapshot({ id: 20, providerOrderId: 'mp-order-20' }),
      overdueSnapshot({ id: 21, providerOrderId: 'mp-order-21' }),
      overdueSnapshot({ id: 22, providerOrderId: 'mp-order-22' }),
      overdueSnapshot({ id: 23, providerOrderId: 'mp-order-23' }),
      overdueSnapshot({ id: 24, providerOrderId: 'mp-order-24' }),
      overdueSnapshot({ id: 25, providerOrderId: 'mp-order-25' }),
    ];
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService(snapshots);
    (mercadoPagoService.getOrderById as jest.Mock)
      .mockResolvedValueOnce(order({ externalReference: '20' }))
      .mockRejectedValueOnce(new Error('Mercado Pago unavailable'))
      .mockResolvedValueOnce(order({
        providerOrderId: 'mp-order-22',
        externalReference: '22',
        status: 'canceled',
        statusDetail: 'canceled',
      }))
      .mockResolvedValueOnce(order({
        providerOrderId: 'mp-order-23',
        externalReference: '23',
        status: 'refunded',
        statusDetail: 'refunded',
      }))
      .mockResolvedValueOnce(order({
        providerOrderId: 'mp-order-24',
        externalReference: '24',
        status: 'created',
        statusDetail: 'created',
      }))
      .mockResolvedValueOnce(order({
        providerOrderId: 'mp-order-25',
        externalReference: '25',
      }));
    (checkoutSnapshotProcessService.processApprovedOrder as jest.Mock)
      .mockRejectedValueOnce(new Error('processor failed'))
      .mockResolvedValueOnce(undefined);

    await expect(service.reconcileOverdueSnapshots()).resolves.toBeUndefined();

    expect(checkoutSnapshotProcessService.processApprovedOrder).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: '20' }),
    );
    expect(checkoutSnapshotProcessService.processCancelledOrder).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: '22' }),
    );
    expect(checkoutSnapshotProcessService.processRefundedOrder).not.toHaveBeenCalled();
    expect(mercadoPagoService.getOrderById).toHaveBeenCalledTimes(6);
  });

  it('does not delegate an order whose external reference belongs to another snapshot', async () => {
    const { service, mercadoPagoService, checkoutSnapshotProcessService } = createService();
    (mercadoPagoService.getOrderById as jest.Mock).mockResolvedValueOnce(order({
      externalReference: '99',
    }));

    await service.reconcileOverdueSnapshots();

    expect(checkoutSnapshotProcessService.processApprovedOrder).not.toHaveBeenCalled();
    expect(checkoutSnapshotProcessService.processCancelledOrder).not.toHaveBeenCalled();
  });
});
