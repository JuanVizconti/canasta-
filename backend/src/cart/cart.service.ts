import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { CartMapper, cartInclude } from './cart.mapper';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async findForUser(userId: number) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: cartInclude,
    });

    return CartMapper.toResponse(cart);
  }

  async addItem(userId: number, { productId, cantidad }: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (cantidad > product.stock) {
      throw new BadRequestException('Requested quantity exceeds product stock');
    }

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        price: new Prisma.Decimal(0),
      },
    });
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (existingItem) {
      const finalQuantity = existingItem.cantidad + cantidad;

      if (finalQuantity > product.stock) {
        throw new BadRequestException('Requested quantity exceeds product stock');
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { cantidad: finalQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          cantidad,
        },
      });
    }

    return this.recalculatePrice(cart.id);
  }

  async updateItem(userId: number, productId: number, { cantidad }: UpdateCartItemDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('Cart item not found');
    }

    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (cantidad > item.product.stock) {
      throw new BadRequestException('Requested quantity exceeds product stock');
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { cantidad },
    });

    return this.recalculatePrice(cart.id);
  }

  async removeItem(userId: number, productId: number) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('Cart item not found');
    }

    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: item.id },
    });

    return this.recalculatePrice(cart.id);
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  private async recalculatePrice(cartId: number) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: cartInclude,
    });
    const price = cart.items.reduce(
      (total, item) => total.plus(item.product.precio.mul(item.cantidad)),
      new Prisma.Decimal(0),
    );
    const updatedCart = await this.prisma.cart.update({
      where: { id: cartId },
      data: { price },
      include: cartInclude,
    });

    return CartMapper.toResponse(updatedCart);
  }
}
