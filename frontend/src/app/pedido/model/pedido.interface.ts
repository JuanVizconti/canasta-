export type PedidoEstado =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED';

export type PedidoDeliveryMethod = 'PICKUP' | 'DELIVERY';

export type PedidoPaymentMethod = 'CASH' | 'MERCADO_PAGO';

export type PedidoPaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface PedidoAddress {
  calle: string | null;
  numero: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  piso: string | null;
  departamento: string | null;
  especificaciones: string | null;
}

export type PedidoDelivery =
  | { method: 'PICKUP' }
  | { method: 'DELIVERY'; address: PedidoAddress };

export interface PedidoItem {
  productId: number;
  nombre: string;
  marca: string;
  cantidad: number;
  unitPrice: string;
}

export interface PedidoPayment {
  method: PedidoPaymentMethod;
  status: PedidoPaymentStatus;
  checkoutUrl: string | null;
}

export interface Pedido {
  id: number;
  estado: PedidoEstado;
  createdAt: string;
  personalInfo: {
    nombre: string;
    apellido: string;
    dni: string;
    telefono: string;
  };
  delivery: PedidoDelivery;
  items: PedidoItem[];
  subtotal: string;
  serviceFee: string;
  deliveryFee: string;
  total: string;
  payment: PedidoPayment | null;
}

export interface PedidoSummary {
  id: number;
  createdAt: string;
  total: string;
  estado: PedidoEstado;
}

export interface RetryPaymentResponse {
  id: number;
  estado: PedidoEstado;
  total: string;
  payment: {
    method: 'MERCADO_PAGO';
    status: 'PENDING';
    checkoutUrl: string | null;
  };
  paymentInitialization: {
    status: 'READY' | 'FAILED';
  };
}
