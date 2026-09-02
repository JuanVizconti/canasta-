import { Prisma } from '@prisma/client';
import { CartMapper, CartWithItems } from './cart.mapper';

describe('CartMapper', () => {
  it('returns an empty cart response for null', () => {
    expect(CartMapper.toResponse(null)).toEqual({
      id: null,
      price: '0.00',
      items: [],
    });
  });

  it('transforms cart and product prices with two decimals', () => {
    const cart = {
      id: 1,
      userId: 2,
      price: new Prisma.Decimal('25.5'),
      items: [
        {
          id: 3,
          cartId: 1,
          productId: 4,
          cantidad: 2,
          product: {
            id: 4,
            marca: 'Canasta',
            nombre: 'Producto de prueba',
            precio: new Prisma.Decimal('12.75'),
            stock: 8,
            imgUrl: 'https://example.com/producto.jpg',
          },
        },
      ],
    } satisfies CartWithItems;

    expect(CartMapper.toResponse(cart)).toEqual({
      id: 1,
      price: '25.50',
      items: [
        {
          id: 3,
          productId: 4,
          cantidad: 2,
          product: {
            id: 4,
            marca: 'Canasta',
            nombre: 'Producto de prueba',
            precio: '12.75',
            stock: 8,
            imgUrl: 'https://example.com/producto.jpg',
          },
        },
      ],
    });
  });
});
