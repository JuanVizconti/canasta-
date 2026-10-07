import {
  DeliveryData,
  PaymentMethod,
  PersonalInfo,
} from '../../checkout/model/checkout.interface';
import { PedidoEstado, PedidoPaymentMethod, PedidoPaymentStatus } from './pedido.interface';

export interface CreatePedidoRequest {
  personalInfo: PersonalInfo;
  delivery: DeliveryData;
  paymentMethod: PaymentMethod;
}

export interface CreatedPedido {
  id: number;
  estado: PedidoEstado;
  total: string;
  payment: {
    method: PedidoPaymentMethod;
    status: PedidoPaymentStatus;
    checkoutUrl?: string | null;
  };
  paymentInitialization?: {
    status: 'READY' | 'FAILED';
  };
}
