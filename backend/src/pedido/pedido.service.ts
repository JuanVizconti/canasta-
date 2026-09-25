import { BadRequestException, HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PedidoEstado, Prisma, PrismaClient } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { DeliveryMethod } from './interfaces/delivery-method.enum';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { PedidoErrorCode } from './interfaces/pedido-error-code.enum';

@Injectable()
export class PedidoService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private static readonly minimumPurchase = new Prisma.Decimal(10000);
  private static readonly serviceFee = new Prisma.Decimal(500);
  private static readonly deliveryPercentage = new Prisma.Decimal('0.10');

  constructor(private readonly cartService: CartService) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  create(userId: number, createPedidoDto: CreatePedidoDto) {
    return this.prisma.pedido.create({
      data: {
        userId,
        ...createPedidoDto,
        estado: PedidoEstado.PENDING,
      },
    });
  }

  async quote(userId: number, { deliveryMethod }: QuotePedidoDto) {
    const subtotal = await this.cartService.getSubtotalForUser(userId);

    if (subtotal.lessThan(PedidoService.minimumPurchase)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: PedidoErrorCode.MINIMUM_PURCHASE_NOT_REACHED,
        message: 'El monto mínimo de compra es de $10.000',
      });
    }

    const serviceFee = PedidoService.serviceFee;
    const deliveryFee = this.calculateDeliveryFee(subtotal, deliveryMethod);
    const total = this.calculateTotal(subtotal, serviceFee, deliveryFee);

    return {
      subtotal: subtotal.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      total: total.toFixed(2),
    };
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  private calculateDeliveryFee(
    subtotal: Prisma.Decimal,
    deliveryMethod: DeliveryMethod,
  ): Prisma.Decimal {
    return deliveryMethod === DeliveryMethod.PICKUP
      ? new Prisma.Decimal(0)
      : subtotal.mul(PedidoService.deliveryPercentage);
  }

  private calculateTotal(
    subtotal: Prisma.Decimal,
    serviceFee: Prisma.Decimal,
    deliveryFee: Prisma.Decimal,
  ): Prisma.Decimal {
    return subtotal.plus(serviceFee).plus(deliveryFee);
  }
}
