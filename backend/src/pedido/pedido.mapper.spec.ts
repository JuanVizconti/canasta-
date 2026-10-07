import { DeliveryMethod, PaymentMethod, PaymentStatus, PedidoEstado, Prisma } from '@prisma/client';
import { PedidoMapper, PedidoWithDetail } from './pedido.mapper';

describe('PedidoMapper', () => {
  const basePedido = (): PedidoWithDetail => ({
    id: 27,
    userId: 7,
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
    deliveryMethod: DeliveryMethod.DELIVERY,
    calle: 'Rivadavia',
    numero: '1234',
    localidad: 'Castelar',
    codigoPostal: '1712',
    piso: null,
    departamento: null,
    especificaciones: null,
    subtotal: new Prisma.Decimal('20000'),
    serviceFee: new Prisma.Decimal('500'),
    deliveryFee: new Prisma.Decimal('2000'),
    total: new Prisma.Decimal('22500'),
    estado: PedidoEstado.CONFIRMED,
    createdAt: new Date('2026-09-28T18:30:00.000Z'),
    expiresAt: null,
    items: [{
      id: 1,
      pedidoId: 27,
      productId: 11,
      nombre: 'Coca-Cola 2.25L',
      marca: 'Coca-Cola',
      cantidad: 2,
      unitPrice: new Prisma.Decimal('2500.5'),
    }],
    payment: {
      id: 1,
      pedidoId: 27,
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
      providerOrderId: null,
      idempotencyKey: null,
      checkoutUrl: null,
      createdAt: new Date('2026-09-28T18:30:00.000Z'),
      updatedAt: new Date('2026-09-28T18:30:00.000Z'),
    },
  });

  it('maps persisted item snapshots and serializes all Decimal values with two decimals', () => {
    expect(PedidoMapper.toDetail(basePedido())).toEqual({
      id: 27,
      estado: PedidoEstado.CONFIRMED,
      createdAt: '2026-09-28T18:30:00.000Z',
      personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
      delivery: {
        method: 'DELIVERY',
        address: {
          calle: 'Rivadavia', numero: '1234', localidad: 'Castelar', codigoPostal: '1712',
          piso: null, departamento: null, especificaciones: null,
        },
      },
      items: [{
        productId: 11, nombre: 'Coca-Cola 2.25L', marca: 'Coca-Cola', cantidad: 2, unitPrice: '2500.50',
      }],
      subtotal: '20000.00', serviceFee: '500.00', deliveryFee: '2000.00', total: '22500.00',
      payment: { method: PaymentMethod.CASH, status: PaymentStatus.PENDING, checkoutUrl: null },
    });
  });

  it('returns a clean PICKUP delivery and handles a legacy pedido without payment', () => {
    const pedido = basePedido();
    pedido.deliveryMethod = DeliveryMethod.PICKUP;
    pedido.payment = null;

    const response = PedidoMapper.toDetail(pedido);

    expect(response.delivery).toEqual({ method: 'PICKUP' });
    expect(response.payment).toBeNull();
  });
});
