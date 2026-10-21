import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CheckoutSnapshotStatus,
  DeliveryMethod as PrismaDeliveryMethod,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { CreatePedidoDto } from '../pedido/dto/create-pedido.dto';
import { CommerceSettingsService } from '../commerce-settings/commerce-settings.service';
import { DeliveryMethod } from '../pedido/interfaces/delivery-method.enum';
import { PedidoErrorCode } from '../pedido/interfaces/pedido-error-code.enum';

export type CreateCheckoutSnapshotInput = Pick<
  CreatePedidoDto,
  'personalInfo' | 'delivery'
>;

const cartForCheckoutInclude = {
  items: {
    include: {
      product: true,
    },
  },
} satisfies Prisma.CartInclude;

type CartForCheckout = Prisma.CartGetPayload<{
  include: typeof cartForCheckoutInclude;
}>;

@Injectable()
export class CheckoutSnapshotService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private static readonly deliveryPercentage = new Prisma.Decimal('0.10');
  private static readonly expirationMinutes = 30;

  constructor(private readonly commerceSettingsService: CommerceSettingsService) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async create(userId: number, checkout: CreateCheckoutSnapshotInput) {
    const idempotencyKey = randomUUID();
    
    const expiresAt = new Date(
      Date.now() + CheckoutSnapshotService.expirationMinutes * 60 * 1000,
    );

    return this.prisma.$transaction(async (transaction) => {
      
      const cart = await transaction.cart.findUnique({
        where: { userId },
        include: cartForCheckoutInclude,
      });

      this.ensureCartHasItems(cart);
      this.ensureProductsAreValid(cart.items);
      this.ensureStockIsAvailable(cart.items);

      const subtotal = this.calculateSubtotal(cart.items);
      const settings = await this.commerceSettingsService.validateMinimumPurchase(subtotal);
      const pricing = this.calculatePricing(
        subtotal,
        checkout.delivery.method,
        settings.serviceFee,
      );

      const snapshot = await transaction.checkoutSnapshot.create({
        data: {
          userId,
          status: CheckoutSnapshotStatus.ACTIVE,
          idempotencyKey,
          expiresAt,
          ...checkout.personalInfo,
          deliveryMethod: this.toPrismaDeliveryMethod(checkout.delivery.method),
          ...this.getDeliveryAddress(checkout.delivery),
          subtotal: pricing.subtotal,
          serviceFee: pricing.serviceFee,
          deliveryFee: pricing.deliveryFee,
          total: pricing.total,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              nombre: item.product.nombre,
              marca: item.product.marca,
              cantidad: item.cantidad,
              unitPrice: item.product.precio,
            })),
          },
        },
        select: {
          id: true,
          status: true,
          idempotencyKey: true,
          expiresAt: true,
          subtotal: true,
          serviceFee: true,
          deliveryFee: true,
          total: true,
          user: {
            select: { email: true },
          },
          items: true,
        },
      });

      await this.reserveStock(transaction, cart.items);

      return snapshot;
    });
  }

/*Guarda informacion de orden en snapshot */
  async saveMercadoPagoOrder(snapshotId: number,providerOrderId: string,checkoutUrl: string,): Promise<void> {
    await this.prisma.checkoutSnapshot.update({
      where: { id: snapshotId },
      data: { providerOrderId, checkoutUrl },
    });
  }

/*Busca snapshot por userId */
  async findStatusForUser(userId: number, snapshotId: number) {
    if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
      throw new BadRequestException('Checkout snapshot id must be a positive integer');
    }

    const snapshot = await this.prisma.checkoutSnapshot.findFirst({
      where: { id: snapshotId, userId },
      select: {
        status: true,
        pedidoId: true,
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Checkout snapshot not found');
    }

    if (
      snapshot.status === CheckoutSnapshotStatus.COMPLETED &&
      snapshot.pedidoId === null
    ) {
      throw new InternalServerErrorException(
        'Checkout snapshot is in an inconsistent state',
      );
    }

    return snapshot;
  }

/*snapshot fallida*/  
  async markFailedAndRestoreStock(snapshotId: number): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const snapshot = await transaction.checkoutSnapshot.findUnique({
        where: { id: snapshotId },
        select: {
          status: true,
          items: {
            select: {
              productId: true,
              cantidad: true,
            },
          },
        },
      });

      if (!snapshot || snapshot.status !== CheckoutSnapshotStatus.ACTIVE) {
        return;
      }

      await transaction.checkoutSnapshot.update({
        where: { id: snapshotId },
        data: { status: CheckoutSnapshotStatus.FAILED },
      });

      for (const item of snapshot.items) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.cantidad } },
        });
      }
    });
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

 /*----------------------------------------Pricing and cart-------------------------------------------*/ 

  private calculateSubtotal(items: CartForCheckout['items']): Prisma.Decimal {
    return items.reduce(
      (total, item) => total.plus(item.product.precio.mul(item.cantidad)),
      new Prisma.Decimal(0),
    );
  }

  private calculatePricing(
    subtotal: Prisma.Decimal,
    deliveryMethod: DeliveryMethod,
    serviceFee: Prisma.Decimal,
  ) {
    const deliveryFee = deliveryMethod === DeliveryMethod.PICKUP
    ? new Prisma.Decimal(0)
    : subtotal.mul(CheckoutSnapshotService.deliveryPercentage);
    
    return {
      subtotal,
      serviceFee,
      deliveryFee,
      total: subtotal.plus(serviceFee).plus(deliveryFee),
    };
  }
  
  private async reserveStock(
    transaction: Prisma.TransactionClient,
    items: CartForCheckout['items'],
  ): Promise<void> {
    for (const item of items) {
      const updatedProducts = await transaction.product.updateMany({
        where: {
          id: item.productId,
          stock: { gte: item.cantidad },
        },
        data: {
          stock: { decrement: item.cantidad },
        },
      });
      
      if (updatedProducts.count !== 1) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          code: PedidoErrorCode.INSUFFICIENT_STOCK,
          message: 'Un o más productos ya no tienen stock suficiente',
        });
      }
    }
  }
  
  /*---------------------------------------Validators---------------------------------------------------*/
  
  private toPrismaDeliveryMethod(deliveryMethod: DeliveryMethod): PrismaDeliveryMethod {
    return deliveryMethod === DeliveryMethod.PICKUP
    ? PrismaDeliveryMethod.PICKUP
    : PrismaDeliveryMethod.DELIVERY;
  }
  
  private getDeliveryAddress(delivery: CreateCheckoutSnapshotInput['delivery']) {
    if (delivery.method === DeliveryMethod.DELIVERY) {
      return {
        calle: delivery.address?.calle ?? null,
        numero: delivery.address?.numero ?? null,
        localidad: delivery.address?.localidad ?? null,
        codigoPostal: delivery.address?.codigoPostal ?? null,
        piso: delivery.address?.piso ?? null,
        departamento: delivery.address?.departamento ?? null,
        especificaciones: delivery.address?.especificaciones ?? null,
      };
    }
    
    return {
      calle: null,
      numero: null,
      localidad: null,
      codigoPostal: null,
      piso: null,
      departamento: null,
      especificaciones: null,
    };
  }

  private ensureCartHasItems(
    cart: CartForCheckout | null,
  ): asserts cart is CartForCheckout {
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'El carrito está vacío.',
      });
    }
  }
  
  private ensureProductsAreValid(
    items: Array<{ product: unknown | null }>,
  ): void {
    if (items.some((item) => !item.product)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'El carrito contiene un producto inválido.',
      });
    }
  }
  
  private ensureStockIsAvailable(items: CartForCheckout['items']): void {
    if (items.some((item) => item.cantidad > item.product.stock)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: PedidoErrorCode.INSUFFICIENT_STOCK,
        message: 'Un o más productos ya no tienen stock suficiente',
      });
    }
  }
}
