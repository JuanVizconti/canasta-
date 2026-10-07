import { Cart } from '../../cart/model/cart.interface';

export interface PersonalInfo {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
}

export type DeliveryMethod = 'PICKUP' | 'DELIVERY';

export interface DeliveryAddress {
  calle: string;
  numero: string;
  localidad: string;
  codigoPostal: string;
  piso?: string;
  departamento?: string;
  especificaciones?: string;
}

export type DeliveryData =
  | { method: 'PICKUP' }
  | { method: 'DELIVERY'; address: DeliveryAddress };

export type CheckoutStep =
  | 'cart-review'
  | 'personal-info'
  | 'delivery'
  | 'payment'
  | 'confirmation';

export type PaymentMethod = 'CASH' | 'MERCADO_PAGO';

export interface PaymentData {
  method: PaymentMethod;
}

export interface CheckoutData {
  currentStep: CheckoutStep;
  personalInfo: PersonalInfo;
  delivery: DeliveryData | null;
  cart: Cart | null;
  payment: PaymentData | null;
}

export interface Pedido {
  id: number;
  userId: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  estado: string;
  createdAt: string;
}
