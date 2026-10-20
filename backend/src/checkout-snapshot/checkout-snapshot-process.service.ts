import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CheckoutSnapshotStatus,
  PaymentMethod,
  PaymentStatus,
  PedidoEstado,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { MercadoPagoOrderDetails } from '../mercado-pago/mercado-pago.types';
import { PedidoService } from '../pedido/pedido.service';

const snapshotForApprovalSelect = {
  id: true,
  userId: true,
  status: true,
  providerOrderId: true,
  nombre: true,
  apellido: true,
  dni: true,
  telefono: true,
  deliveryMethod: true,
  calle: true,
  numero: true,
  localidad: true,
  codigoPostal: true,
  piso: true,
  departamento: true,
  especificaciones: true,
  subtotal: true,
  serviceFee: true,
  deliveryFee: true,
  total: true,
  pedidoId: true,
  items: {
    select: {
      productId: true,
      nombre: true,
      marca: true,
      cantidad: true,
      unitPrice: true,
    },
  },
} satisfies Prisma.CheckoutSnapshotSelect;

type CheckoutSnapshotForApproval = Prisma.CheckoutSnapshotGetPayload<{
  select: typeof snapshotForApprovalSelect;
}>;

type SnapshotClient = Pick<PrismaClient, 'checkoutSnapshot'>;
type SnapshotTransactionClient = Pick<
  Prisma.TransactionClient,
  'cart' | 'cartItem' | 'checkoutSnapshot' | 'product'
>;

@Injectable()
export class CheckoutSnapshotProcessService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor(private readonly pedidoService: PedidoService) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  
  async processApprovedOrder(order: MercadoPagoOrderDetails): Promise<void> {
    const snapshotId = this.toSnapshotId(order.externalReference);
    const snapshot = await this.findSnapshot(this.prisma, snapshotId);

    this.ensureProviderOrderMatches(snapshot, order.providerOrderId);
    
    if (this.isCompleted(snapshot)) {
      return;
    }

    this.ensureSnapshotCanBeCompleted(snapshot);

    await this.prisma.$transaction(async (transaction) => {
      const currentSnapshot = await this.findSnapshot(transaction, snapshotId);

      this.ensureProviderOrderMatches(currentSnapshot, order.providerOrderId);
      if (this.isCompleted(currentSnapshot)) {
        return;
      }

      this.ensureSnapshotCanBeCompleted(currentSnapshot);

      const claim = await transaction.checkoutSnapshot.updateMany({
        where: {
          id: snapshotId,
          status: CheckoutSnapshotStatus.ACTIVE,
        },
        data: { status: CheckoutSnapshotStatus.COMPLETED },
      });

      if (claim.count === 0) {
        const claimedSnapshot = await this.findSnapshot(transaction, snapshotId);

        this.ensureProviderOrderMatches(claimedSnapshot, order.providerOrderId);
        if (this.isCompleted(claimedSnapshot)) {
          return;
        }

        if (claimedSnapshot.status === CheckoutSnapshotStatus.ACTIVE) {
          throw new BadRequestException('Checkout snapshot could not be claimed');
        }

        this.ensureSnapshotCanBeCompleted(claimedSnapshot);
      }

      const pedido = await transaction.pedido.create({
        data: {
          userId: currentSnapshot.userId,
          nombre: currentSnapshot.nombre,
          apellido: currentSnapshot.apellido,
          dni: currentSnapshot.dni,
          telefono: currentSnapshot.telefono,
          deliveryMethod: currentSnapshot.deliveryMethod,
          calle: currentSnapshot.calle,
          numero: currentSnapshot.numero,
          localidad: currentSnapshot.localidad,
          codigoPostal: currentSnapshot.codigoPostal,
          piso: currentSnapshot.piso,
          departamento: currentSnapshot.departamento,
          especificaciones: currentSnapshot.especificaciones,
          subtotal: currentSnapshot.subtotal,
          serviceFee: currentSnapshot.serviceFee,
          deliveryFee: currentSnapshot.deliveryFee,
          total: currentSnapshot.total,
          estado: PedidoEstado.CONFIRMED,
        },
        select: { id: true },
      });

      await transaction.pedidoItem.createMany({
        data: currentSnapshot.items.map((item) => ({
          pedidoId: pedido.id,
          productId: item.productId,
          nombre: item.nombre,
          marca: item.marca,
          cantidad: item.cantidad,
          unitPrice: item.unitPrice,
        })),
      });

      await transaction.payment.create({
        data: {
          pedidoId: pedido.id,
          method: PaymentMethod.MERCADO_PAGO,
          status: PaymentStatus.APPROVED,
          providerOrderId: order.providerOrderId,
        },
      });

      await this.clearCartForUser(transaction, currentSnapshot.userId);

      await transaction.checkoutSnapshot.update({
        where: { id: currentSnapshot.id },
        data: { pedidoId: pedido.id },
      });
    });
  }

  async processCancelledOrder(order: MercadoPagoOrderDetails): Promise<void> {
    const snapshotId = this.toSnapshotId(order.externalReference);
    const snapshot = await this.findSnapshot(this.prisma, snapshotId);

    this.ensureProviderOrderMatches(snapshot, order.providerOrderId);
    if (snapshot.status !== CheckoutSnapshotStatus.ACTIVE) {
      return;
    }

    await this.prisma.$transaction(async (transaction) => {
      const currentSnapshot = await this.findSnapshot(transaction, snapshotId);

      this.ensureProviderOrderMatches(currentSnapshot, order.providerOrderId);
      if (currentSnapshot.status !== CheckoutSnapshotStatus.ACTIVE) {
        return;
      }

      const claim = await transaction.checkoutSnapshot.updateMany({
        where: {
          id: snapshotId,
          status: CheckoutSnapshotStatus.ACTIVE,
        },
        data: { status: CheckoutSnapshotStatus.EXPIRED },
      });

      if (claim.count === 0) {
        const claimedSnapshot = await this.findSnapshot(transaction, snapshotId);

        this.ensureProviderOrderMatches(claimedSnapshot, order.providerOrderId);
        if (claimedSnapshot.status === CheckoutSnapshotStatus.ACTIVE) {
          throw new BadRequestException('Checkout snapshot could not be expired');
        }

        return;
      }

      await this.restoreStock(transaction, currentSnapshot.items);
    });
  }

  async processRefundedOrder(order: MercadoPagoOrderDetails): Promise<void> {
    const snapshotId = this.toSnapshotId(order.externalReference);
    const snapshot = await this.findSnapshot(this.prisma, snapshotId);

    this.ensureProviderOrderMatches(snapshot, order.providerOrderId);
    if (snapshot.status !== CheckoutSnapshotStatus.COMPLETED) {
      throw new BadRequestException('Checkout snapshot is not completed');
    }

    if (snapshot.pedidoId === null) {
      throw new BadRequestException('Checkout snapshot is in an inconsistent state');
    }

    await this.pedidoService.processMercadoPagoRefund(
      snapshot.pedidoId,
      order.providerOrderId,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
  
/*------------------------------Helpers--------------------------------*/

  private async findSnapshot(client: SnapshotClient,snapshotId: number,): Promise<CheckoutSnapshotForApproval> {
    const snapshot = await client.checkoutSnapshot.findUnique({
      where: { id: snapshotId },
      select: snapshotForApprovalSelect,
    });
    
    if (!snapshot) {
      throw new NotFoundException('Checkout snapshot not found');
    }
    
    return snapshot;
  }

  private async clearCartForUser(
    transaction: SnapshotTransactionClient,
    userId: number,
  ): Promise<void> {
    await transaction.cartItem.deleteMany({
      where: { cart: { userId } },
    });

    await transaction.cart.updateMany({
      where: { userId },
      data: { price: new Prisma.Decimal(0) },
    });
  }

  private async restoreStock(
    transaction: SnapshotTransactionClient,
    items: CheckoutSnapshotForApproval['items'],
  ): Promise<void> {
    for (const item of items) {
      await transaction.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.cantidad } },
      });
    }
  }
    
  /*--------------------------------------Validators----------------------------------*/
  
  private toSnapshotId(externalReference: string): number {
    const snapshotId = Number(externalReference);
    if (!Number.isFinite(snapshotId) || !Number.isInteger(snapshotId) || snapshotId <= 0) {
      throw new BadRequestException('Mercado Pago order external reference is invalid');
    }

    return snapshotId;
  }

  private ensureProviderOrderMatches(snapshot: CheckoutSnapshotForApproval,providerOrderId: string,): void {
    if (
      snapshot.providerOrderId !== null &&
      snapshot.providerOrderId !== providerOrderId
    ) {
      throw new BadRequestException('Mercado Pago order does not match checkout snapshot');
    }
  }

  private isCompleted(snapshot: CheckoutSnapshotForApproval): boolean {
    if (snapshot.status !== CheckoutSnapshotStatus.COMPLETED) {
      return false;
    }

    if (snapshot.pedidoId === null) {
      throw new BadRequestException('Checkout snapshot is in an inconsistent state');
    }

    return true;
  }

  private ensureSnapshotCanBeCompleted(snapshot: CheckoutSnapshotForApproval): void {
    if (
      snapshot.status !== CheckoutSnapshotStatus.ACTIVE ||
      snapshot.pedidoId !== null
    ) {
      throw new BadRequestException('Checkout snapshot cannot be completed');
    }
  }
}
