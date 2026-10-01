import { BadRequestException, HttpStatus, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { DeliveryMethod } from './interfaces/delivery-method.enum';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { PedidoErrorCode } from './interfaces/pedido-error-code.enum';
import { PedidoMapper, pedidoDetailInclude } from './pedido.mapper';

@Injectable()
export class PedidoService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private static readonly minimumPurchase = new Prisma.Decimal(10000);
  private static readonly serviceFee = new Prisma.Decimal(500);
  private static readonly deliveryPercentage = new Prisma.Decimal('0.10');
  private static readonly paymentExpirationMinutes = 30;
  private static readonly mercadoPagoExpirationTime = 'PT30M';

  constructor(
    private readonly cartService: CartService,
    private readonly mercadoPagoService: MercadoPagoService,
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
    switch (createPedidoDto.paymentMethod){
      case PaymentMethod.CASH:
        return this.createCashPedido(userId, createPedidoDto);

      case PaymentMethod.MERCADO_PAGO:
        return this.createMercadoPagoPedido(userId, createPedidoDto);
    }
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

  async quote(userId: number, { deliveryMethod }: QuotePedidoDto) {
    const subtotal = await this.cartService.getSubtotalForUser(userId);
    const pricing = this.calculatePricing(subtotal, deliveryMethod);

    return {
      subtotal: pricing.subtotal.toFixed(2),
      serviceFee: pricing.serviceFee.toFixed(2),
      deliveryFee: pricing.deliveryFee.toFixed(2),
      total: pricing.total.toFixed(2),
    };
  }

  private async createCashPedido(
    userId: number, createPedidoDto: CreatePedidoDto,
  ){
    return this.prisma.$transaction(async (transaction) => {
      const cart= await this.getCartForCheckout(transaction, userId);

      const subTotal= this.calculateSubtotal(cart?.items ?? []);

      const pricing= this.calculatePricing(subTotal, createPedidoDto.delivery.method);
      
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

  private async createMercadoPagoPedido(
    userId: number, createPedidoDto: CreatePedidoDto,
  ) {
    const idempotencyKey = randomUUID();
    
    const expiresAt = new Date(
      Date.now() + PedidoService.paymentExpirationMinutes * 60 * 1000,
    );
    
    const pedido = await this.prisma.$transaction(async (transaction) => {
    
    const cart = await this.getCartForCheckout(transaction, userId);
    
    const subtotal = this.calculateSubtotal(cart?.items ?? []);
    
    const pricing = this.calculatePricing(subtotal, createPedidoDto.delivery.method);

    const pendingPedido = await transaction.pedido.create({
      data: {
        userId,
        ...createPedidoDto.personalInfo,
        
        deliveryMethod: this.toPrismaDeliveryMethod(createPedidoDto.delivery.method),
        ...this.getDeliveryAddress(createPedidoDto.delivery),
        
        subtotal: pricing.subtotal,
        serviceFee: pricing.serviceFee,
        deliveryFee: pricing.deliveryFee,
        total: pricing.total,
        
        estado: PedidoEstado.PENDING,
        
        expiresAt,
        
        items: {
          create: this.biuldPedidoItems(cart?.items ?? []),
        },
        
        payment: {
          create: {
            method: PaymentMethod.MERCADO_PAGO,
            status: PaymentStatus.PENDING,
            providerOrderId: null,
            idempotencyKey,
            checkoutUrl: null,
          },
        },
      },
      
      select: {
        id: true,
        estado: true,
        total: true,
        user: { select: { email: true } },       
        payment: {
          select: {
            method: true,
            status: true,
            idempotencyKey: true,
          },
        },
      },
    });

    await this.decrementStock(transaction, cart?.items ?? []);

    await this.clearCart(transaction, cart);

    return pendingPedido;
  });

  const payment = pedido.payment;
  if (!payment?.idempotencyKey) {
    throw new Error('Mercado Pago payment was created without an idempotency key');
  }

  try {
    const order = await this.mercadoPagoService.createOrder({
      pedidoId: pedido.id,
      idempotencyKey: payment.idempotencyKey,
      total: pedido.total.toFixed(2),
      expirationTime: PedidoService.mercadoPagoExpirationTime,
      payerEmail: pedido.user.email,      
    });

    await this.prisma.payment.update({
      where: { pedidoId: pedido.id },
      data: {
        providerOrderId: order.providerOrderId,
        checkoutUrl: order.checkoutUrl,
      },
    });

    return {
      id: pedido.id,
      estado: pedido.estado,
      total: pedido.total.toFixed(2),
      payment: {
        method: payment.method,
        status: payment.status,
        checkoutUrl: order.checkoutUrl,
      },
      paymentInitialization: { status: 'READY' as const },
    };
  } catch {
    return {
      id: pedido.id,
      estado: pedido.estado,
      total: pedido.total.toFixed(2),
      payment: {
        method: payment.method,
        status: payment.status,
        checkoutUrl: null,
      },
      paymentInitialization: { status: 'FAILED' as const },
    };
  }
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

  private calculatePricing(subtotal: Prisma.Decimal, deliveryMethod: DeliveryMethod) {
    if (subtotal.lessThan(PedidoService.minimumPurchase)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: PedidoErrorCode.MINIMUM_PURCHASE_NOT_REACHED,
        message: 'El monto mínimo de compra es de $10.000',
      });
    }

    const serviceFee = PedidoService.serviceFee;
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

  /*--------------------------------Helpers create-------------------------------------------*/
  
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
}
