import { Prisma } from '@prisma/client';

export const cartInclude = {
  items: {
    orderBy:{
      id: 'asc',
    },
    include: {
      product: true,
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

export class CartMapper {
  static toResponse(cart: CartWithItems | null) {
    if (!cart) {
      return {
        id: null,
        price: '0.00',
        items: [],
      };
    }

    return {
      id: cart.id,
      price: cart.price.toFixed(2),
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        cantidad: item.cantidad,
        product: {
          id: item.product.id,
          marca: item.product.marca,
          nombre: item.product.nombre,
          precio: item.product.precio.toFixed(2),
          stock: item.product.stock,
          imgUrl: item.product.imgUrl,
        },
      })),
    };
  }
}
