import { BadRequestException, HttpStatus, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DeliveryMethod as PrismaDeliveryMethod,
  PaymentMethod,
  PaymentStatus,
  PedidoEstado,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { CommerceSettingsService } from '../commerce-settings/commerce-settings.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { DeliveryMethod } from './interfaces/delivery-method.enum';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { PedidoErrorCode } from './interfaces/pedido-error-code.enum';
import { PedidoMapper, pedidoDetailInclude } from './pedido.mapper';

const pedidoForMercadoPagoRefundSelect = {
  id: true,
  estado: true,
  payment: {
    select: {
      id: true,
      method: true,
      status: true,
      providerOrderId: true,
    },
  },
  items: {
    select: {
      productId: true,
      cantidad: true,
    },
  },
} satisfies Prisma.PedidoSelect;

type PedidoForMercadoPagoRefund = Prisma.PedidoGetPayload<{
  select: typeof pedidoForMercadoPagoRefundSelect;
}>;

type PedidoWithMercadoPagoPayment = PedidoForMercadoPagoRefund & {
  payment: NonNullable<PedidoForMercadoPagoRefund['payment']>;
};

@Injectable()
export class PedidoService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private static readonly deliveryPercentage = new Prisma.Decimal('0.10');

  constructor(
    private readonly cartService: CartService,
    private readonly commerceSettingsService: CommerceSettingsService,
  ) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async create(userId: number, createPedidoDto: CreatePedidoDto) {
    if (createPedidoDto.paymentMethod !== PaymentMethod.CASH) {
      throw new BadRequestException('POST /pedidos only supports CASH payments');
    }

    return this.createCashPedido(userId, createPedidoDto);
  }

  async processMercadoPagoRefund(
    pedidoId: number,
    providerOrderId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const pedido = await this.findPedidoForMercadoPagoRefund(
        transaction,
        pedidoId,
      );
      
      this.ensureMercadoPagoRefundPayment(pedido, providerOrderId);
      if (this.isAlreadyRefunded(pedido)) {
        return;
      }
      
      this.ensureRefundCanBeProcessed(pedido);
      
      const updatedPayment = await transaction.payment.updateMany({
        where: {
          id: pedido.payment.id,
          status: PaymentStatus.APPROVED,
        },
        data: { status: PaymentStatus.REFUNDED },
      });
      
      if (updatedPayment.count === 0) {
        const currentPedido = await this.findPedidoForMercadoPagoRefund(
          transaction,
          pedidoId,
        );
        
        this.ensureMercadoPagoRefundPayment(currentPedido, providerOrderId);
        if (this.isAlreadyRefunded(currentPedido)) {
          return;
        }
        
        throw new BadRequestException(
          'Mercado Pago refund references an incompatible pedido state',
        );
      }
      
      const updatedPedido = await transaction.pedido.updateMany({
        where: {
          id: pedido.id,
          estado: PedidoEstado.CONFIRMED,
        },
        data: { estado: PedidoEstado.CANCELLED },
      });
      
      if (updatedPedido.count !== 1) {
        throw new BadRequestException(
          'Mercado Pago refund references an incompatible pedido state',
        );
      }
      
      await this.restorePedidoStock(transaction, pedido.items);
    });
  }
  
  private async createCashPedido(
    userId: number, createPedidoDto: CreatePedidoDto,
  ){
    return this.prisma.$transaction(async (transaction) => {
      const cart= await this.getCartForCheckout(transaction, userId);
      
      const subTotal= this.calculateSubtotal(cart?.items ?? []);
      const settings = await this.commerceSettingsService.validateMinimumPurchase(subTotal);
      const pricing= this.calculatePricing(
        subTotal,
        createPedidoDto.delivery.method,
        settings.serviceFee,
      );
      
      const pedido= await transaction.pedido.create({
        data:{
          userId,
          ...createPedidoDto.personalInfo,
          
          deliveryMethod: this.toPrismaDeliveryMethod(
            createPedidoDto.delivery.method,
          ),
          
          ...this.getDeliveryAddress(createPedidoDto.delivery),
          
          subtotal:pricing.subtotal,
          serviceFee: pricing.serviceFee,
          deliveryFee: pricing.deliveryFee,
          total: pricing.total,
          
          estado: PedidoEstado.CONFIRMED,
          
          items:{
            create: this.biuldPedidoItems(cart?.items ?? []),
          },
          
          payment: {
            create: {
              method: PaymentMethod.CASH,
              status: PaymentStatus.PENDING,
              providerOrderId: null,
            },
          },
        },
        
        select:{
          id:true, 
          estado: true,
          total: true,
          payment: {
            select: {
              method: true,
              status: true, 
            },
          },
        },
      });
      
      await this.decrementStock(transaction, cart?.items?? []);
      
      await this.clearCart(transaction, cart);
      
      return this.mapCreatedPedido(pedido);
    });
  }
  
  async quote(userId: number, { deliveryMethod }: QuotePedidoDto) {
    const subtotal = await this.cartService.getSubtotalForUser(userId);
    const settings = await this.commerceSettingsService.validateMinimumPurchase(subtotal);
    const pricing = this.calculatePricing(
      subtotal,
      deliveryMethod,
      settings.serviceFee,
    );
    
    return {
      subtotal: pricing.subtotal.toFixed(2),
      serviceFee: pricing.serviceFee.toFixed(2),
      deliveryFee: pricing.deliveryFee.toFixed(2),
      total: pricing.total.toFixed(2),
    };
  }
  
  async findOneForUser(userId: number, pedidoId: number) {
    const pedido = await this.prisma.pedido.findFirst({
      where: {
        id: pedidoId,
        userId,
      },
      include: pedidoDetailInclude,
    });
    
    if (!pedido) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        code: PedidoErrorCode.PEDIDO_NOT_FOUND,
        message: 'Pedido no encontrado.',
      });
    }
    
    return PedidoMapper.toDetail(pedido);
  }
  
  async findAllByUser(userId: number) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        total: true,
        estado: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return pedidos.map((pedido) => ({
      ...pedido,
      total: pedido.total.toFixed(2),
    }));
  }
  
  private async findPedidoForMercadoPagoRefund(
    client: Pick<PrismaClient, 'pedido'> | Prisma.TransactionClient,
    pedidoId: number,
  ): Promise<PedidoForMercadoPagoRefund | null> {
    return client.pedido.findUnique({
      where: { id: pedidoId },
      select: pedidoForMercadoPagoRefundSelect,
    });
  }
  
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
  
  /*---------------------------------Helpers precio----------------------------------------*/
  
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
  
  private calculatePricing(
    subtotal: Prisma.Decimal,
    deliveryMethod: DeliveryMethod,
    serviceFee: Prisma.Decimal,
  ) {
    const deliveryFee = this.calculateDeliveryFee(subtotal, deliveryMethod);
    
    return {
      subtotal,
      serviceFee,
      deliveryFee,
      total: this.calculateTotal(subtotal, serviceFee, deliveryFee),
    };
  }
  
  private calculateSubtotal(
    items: Array<{ cantidad: number; product: { precio: Prisma.Decimal } }>,
  ): Prisma.Decimal {
    return items.reduce(
      (total, item) => total.plus(item.product.precio.mul(item.cantidad)),
      new Prisma.Decimal(0),
    );
  }
  
  /*--------------------------------Helpers-------------------------------------------*/
  
  private async restorePedidoStock(
    transaction: Prisma.TransactionClient,
    items: PedidoForMercadoPagoRefund['items'],
  ): Promise<void> {
    for (const item of items) {
      await transaction.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.cantidad } },
      });
    }
  }

  private getCartForCheckout(transaction: Prisma.TransactionClient, userId: number){
    return transaction.cart.findUnique({
      where: {userId},
      include: {
        items:{
          include:{
            product: true,
          },
        },
      },
    });
  }
  
  private biuldPedidoItems(
    items: Array<{
      productId: number;
      cantidad: number;
      product: {
        nombre: string;
        marca: string;
        precio: Prisma.Decimal;
      };
    }>,
  ){
    return items.map((item) => ({
      productId: item.productId,
      nombre: item.product.nombre,
      marca: item.product.marca,
      cantidad: item.cantidad,
      unitPrice: item.product.precio,
      
    }));
  }
  
  private async decrementStock(
    transaction: Prisma.TransactionClient,
    items: Array<{
      productId: number;
      cantidad: number;
    }>,
  ){
    for(const item of items){
      const updatedProducts = await transaction.product.updateMany({
        where:{
          id: item.productId,
          stock: {
            gte: item.cantidad,
          },
        },
        
        data:{
          stock: {
            decrement: item.cantidad,
          },
        },
      });
      
      if(updatedProducts.count !== 1){
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          code: PedidoErrorCode.INSUFFICIENT_STOCK,
          message: 'Un o más productos ya no tienen stock suficiente',
        });
      }
    }
  }
  
  private async clearCart (
    transaction: Prisma.TransactionClient,
    cart: {id: number}| null,
  ){
    if(!cart){
      return;
    }
    
    await transaction.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });
    
    await transaction.cart.update({
      where:{
        id: cart.id,
      },
      
      data: {
        price: new Prisma.Decimal(0),
      },
    });
  }
  
  /*--------------------------------------Mapers-------------------------------------------*/
  
  private mapCreatedPedido(pedido:{
    id:number;
    estado:PedidoEstado;
    total: Prisma.Decimal;
    payment: {
      method: PaymentMethod;
      status: PaymentStatus;
    } | null;
  }){
    return {
      id: pedido.id,
      estado: pedido.estado,
      total: pedido.total.toFixed(2),
      payment: pedido.payment,
    };
  }
  
  private toPrismaDeliveryMethod(deliveryMethod: DeliveryMethod): PrismaDeliveryMethod {
    return deliveryMethod === DeliveryMethod.PICKUP
    ? PrismaDeliveryMethod.PICKUP
    : PrismaDeliveryMethod.DELIVERY;
  }
  
  private getDeliveryAddress(delivery: CreatePedidoDto['delivery']) {
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

  /*-----------------------------------------Validators------------------------------*/
  
  private ensureMercadoPagoRefundPayment(
    pedido: PedidoForMercadoPagoRefund | null,
    providerOrderId: string,
  ): asserts pedido is PedidoWithMercadoPagoPayment {
    if (!pedido) {
      throw new NotFoundException('Pedido not found');
    }
  
    if (!pedido.payment) {
      throw new BadRequestException('Pedido has no payment');
    }
  
    if (pedido.payment.method !== PaymentMethod.MERCADO_PAGO) {
      throw new BadRequestException('Pedido payment is not Mercado Pago');
    }
  
    if (pedido.payment.providerOrderId !== providerOrderId) {
      throw new BadRequestException('Mercado Pago order does not match pedido payment');
    }
  }
  
  private ensureRefundCanBeProcessed(
    pedido: PedidoForMercadoPagoRefund,
  ): void {
    if (
      pedido.estado !== PedidoEstado.CONFIRMED ||
      pedido.payment?.status !== PaymentStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Mercado Pago refund references an incompatible pedido state',
      );
    }
  }
  
  private isAlreadyRefunded(pedido: PedidoForMercadoPagoRefund): boolean {
    return (
      pedido.estado === PedidoEstado.CANCELLED &&
      pedido.payment?.status === PaymentStatus.REFUNDED
    );
  }
}
