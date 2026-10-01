import { Prisma } from '@prisma/client';

export const pedidoDetailInclude = {
  items: {
    orderBy: { id: 'asc' },
  },
  payment: true,
} satisfies Prisma.PedidoInclude;

export type PedidoWithDetail = Prisma.PedidoGetPayload<{
  include: typeof pedidoDetailInclude;
}>;

export class PedidoMapper {
  static toDetail(pedido: PedidoWithDetail) {
    return {
      id: pedido.id,
      estado: pedido.estado,
      createdAt: pedido.createdAt.toISOString(),
      personalInfo: {
        nombre: pedido.nombre,
        apellido: pedido.apellido,
        dni: pedido.dni,
        telefono: pedido.telefono,
      },
      delivery: pedido.deliveryMethod === 'PICKUP'
        ? { method: 'PICKUP' as const }
        : {
            method: 'DELIVERY' as const,
            address: {
              calle: pedido.calle,
              numero: pedido.numero,
              localidad: pedido.localidad,
              codigoPostal: pedido.codigoPostal,
              piso: pedido.piso,
              departamento: pedido.departamento,
              especificaciones: pedido.especificaciones,
            },
          },
      items: pedido.items.map((item) => ({
        productId: item.productId,
        nombre: item.nombre,
        marca: item.marca,
        cantidad: item.cantidad,
        unitPrice: item.unitPrice.toFixed(2),
      })),
      subtotal: pedido.subtotal.toFixed(2),
      serviceFee: pedido.serviceFee.toFixed(2),
      deliveryFee: pedido.deliveryFee.toFixed(2),
      total: pedido.total.toFixed(2),
      payment: pedido.payment
        ? {
          method: pedido.payment.method,
          status: pedido.payment.status,
          checkoutUrl: pedido.payment.checkoutUrl,
        }
        : null,
    };
  }
}
