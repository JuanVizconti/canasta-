import {
  DeliveryData,
  PaymentMethod,
  PersonalInfo,
} from '../../checkout/model/checkout.interface';

export interface CreatePedidoRequest {
  personalInfo: PersonalInfo;
  delivery: DeliveryData;
  paymentMethod: PaymentMethod;
}

export interface CreatedPedido {
  id: number;
  estado: string;
  total: string;
  payment: {
    method: PaymentMethod;
    status: string;
  };
}
