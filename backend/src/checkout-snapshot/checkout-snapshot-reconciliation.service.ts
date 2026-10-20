import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CheckoutSnapshotStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import { mapMercadoPagoOrderStatus } from '../pedido/mercado-pago-order-status.mapper';
import { CheckoutSnapshotProcessService } from './checkout-snapshot-process.service';

const overdueSnapshotSelect = {
  id: true,
  providerOrderId: true,
  expiresAt: true,
} satisfies Prisma.CheckoutSnapshotSelect;

type OverdueCheckoutSnapshot = Prisma.CheckoutSnapshotGetPayload<{
  select: typeof overdueSnapshotSelect;
}>;

@Injectable()
export class CheckoutSnapshotReconciliationService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private readonly logger = new Logger(CheckoutSnapshotReconciliationService.name);

  constructor(
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly checkoutSnapshotProcessService: CheckoutSnapshotProcessService,
  ) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reconcileOverdueSnapshots(): Promise<void> {
    const snapshots = await this.prisma.checkoutSnapshot.findMany({
      where: {
        status: CheckoutSnapshotStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      select: overdueSnapshotSelect,
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });

    for (const snapshot of snapshots) {
      await this.reconcileSnapshot(snapshot);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async reconcileSnapshot(
    snapshot: OverdueCheckoutSnapshot,
  ): Promise<void> {
    if (snapshot.providerOrderId === null) {
      this.logger.warn(
        `Skipping overdue checkout snapshot ${snapshot.id}: provider order id is missing`,
      );
      return;
    }

    try {
      const order = await this.mercadoPagoService.getOrderById(
        snapshot.providerOrderId,
      );

      if (order.externalReference !== String(snapshot.id)) {
        this.logger.error(
          `Skipping checkout snapshot ${snapshot.id}: Mercado Pago external reference does not match`,
        );
        return;
      }

      const action = mapMercadoPagoOrderStatus(
        order.status,
        order.statusDetail,
      );

      if (action === 'APPROVED') {
        await this.checkoutSnapshotProcessService.processApprovedOrder(order);
        return;
      }

      if (action === 'CANCELLED') {
        await this.checkoutSnapshotProcessService.processCancelledOrder(order);
        return;
      }

      if (action === 'REFUNDED') {
        this.logger.error(
          `Checkout snapshot ${snapshot.id} is ACTIVE but Mercado Pago order ${snapshot.providerOrderId} is refunded`,
        );
        return;
      }

      if (action === 'PARTIALLY_REFUNDED') {
        this.logger.warn(
          `Checkout snapshot ${snapshot.id} is ACTIVE but Mercado Pago order ${snapshot.providerOrderId} is partially refunded`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Could not reconcile checkout snapshot ${snapshot.id}: ${message}`,
      );
    }
  }
}
