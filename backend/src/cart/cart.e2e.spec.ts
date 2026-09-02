import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Cart endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token: string;
  let userId: number;
  let firstProductId: number;
  let secondProductId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
    process.env.JWT_SECRET = 'test-jwt-secret';

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });

    const suffix = Date.now();
    const user = await prisma.user.create({
      data: {
        usuario: `cart-user-${suffix}`,
        email: `cart-user-${suffix}@email.com`,
        passwordHash: 'not-used-by-cart-tests',
      },
    });
    const [firstProduct, secondProduct] = await Promise.all([
      prisma.product.create({
        data: {
          marca: 'Canasta',
          nombre: `Producto carrito A ${suffix}`,
          precio: '10.00',
          stock: 5,
        },
      }),
      prisma.product.create({
        data: {
          marca: 'Canasta',
          nombre: `Producto carrito B ${suffix}`,
          precio: '20.00',
          stock: 3,
        },
      }),
    ]);

    userId = user.id;
    firstProductId = firstProduct.id;
    secondProductId = secondProduct.id;

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    token = await app.get(JwtService).signAsync({ sub: userId });
  });

  beforeEach(async () => {
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.product.deleteMany({
      where: { id: { in: [firstProductId, secondProductId] } },
    });
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('returns 401 without a JWT', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
  });

  it('returns an empty cart with price 0.00 when the user has no cart', async () => {
    await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ id: null, price: '0.00', items: [] });
  });

  it('creates a cart when adding the first product', async () => {
    const response = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 2 })
      .expect(201);

    expect(response.body.price).toBe('20.00');
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      productId: firstProductId,
      cantidad: 2,
    });
  });

  it('adds a new product to an existing cart', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 1 })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: secondProductId, cantidad: 2 })
      .expect(201);

    expect(response.body.price).toBe('50.00');
    expect(response.body.items).toHaveLength(2);
  });

  it('increases the quantity when adding the same product again', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 1 })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 2 })
      .expect(201);

    expect(response.body.price).toBe('30.00');
    expect(response.body.items[0].cantidad).toBe(3);
  });

  it('rejects a quantity greater than product stock', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 6 })
      .expect(400);
  });

  it('replaces an item quantity', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 1 })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/cart/items/${firstProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cantidad: 4 })
      .expect(200);

    expect(response.body.price).toBe('40.00');
    expect(response.body.items[0].cantidad).toBe(4);
  });

  it('deletes an item and keeps an empty cart with price 0.00', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: firstProductId, cantidad: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/cart/items/${firstProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.price).toBe('0.00');
        expect(response.body.items).toEqual([]);
      });
  });
});
