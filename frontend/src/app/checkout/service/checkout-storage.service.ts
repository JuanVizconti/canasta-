import { Injectable } from '@angular/core';
import { Cart } from '../../cart/model/cart.interface';
import {
  CheckoutData,
  CheckoutStep,
  DeliveryData,
  PaymentData,
  PaymentMethod,
  PersonalInfo,
} from '../model/checkout.interface';

const emptyPersonalInfo: PersonalInfo = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
};

@Injectable({ providedIn: 'root' })
export class CheckoutStorageService {
  private readonly storageKey = 'checkout';

  load(): CheckoutData {
    const storedData = sessionStorage.getItem(this.storageKey);

    if (!storedData) {
      return this.createInitialData();
    }

    try {
      const parsedData: unknown = JSON.parse(storedData);
      const checkoutData = this.parseCheckoutData(parsedData);

      if (checkoutData) {
        return checkoutData;
      }
    } catch {
      // An invalid value must not prevent checkout from loading.
    }

    return this.createInitialData();
  }

  save(data: CheckoutData): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  clear(): void {
    sessionStorage.removeItem(this.storageKey);
  }

  private createInitialData(): CheckoutData {
    return {
      currentStep: 'cart-review',
      personalInfo: { ...emptyPersonalInfo },
      delivery: null,
      cart: null,
      payment: null,
    };
  }

  private parseCheckoutData(value: unknown): CheckoutData | null {
    if (!value || typeof value !== 'object' || !('personalInfo' in value)) {
      return null;
    }

    const personalInfo = value.personalInfo;

    if (!this.isPersonalInfo(personalInfo)) {
      return null;
    }

    const currentStep = 'currentStep' in value ? value.currentStep : 'cart-review';
    const delivery = 'delivery' in value ? value.delivery : null;
    const cart = 'cart' in value ? value.cart : null;
    const payment = 'payment' in value ? value.payment : null;

    if (
      !this.isCheckoutStep(currentStep) ||
      !this.isDeliveryData(delivery) ||
      !this.isCart(cart) ||
      !this.isPaymentData(payment)
    ) {
      return null;
    }

    return {
      currentStep,
      personalInfo,
      delivery: delivery ?? null,
      cart: cart ?? null,
      payment: payment ?? null,
    };
  }

  private isCheckoutStep(value: unknown): value is CheckoutStep {
    return (
      value === 'cart-review' ||
      value === 'personal-info' ||
      value === 'delivery' ||
      value === 'payment' ||
      value === 'confirmation'
    );
  }

  private isPaymentData(value: unknown): value is PaymentData | null {
    return (
      value === null ||
      value === undefined ||
      (!!value &&
        typeof value === 'object' &&
        'method' in value &&
        this.isPaymentMethod(value.method))
    );
  }

  private isPaymentMethod(value: unknown): value is PaymentMethod {
    return value === 'CASH' || value === 'MERCADO_PAGO';
  }

  private isPersonalInfo(value: unknown): value is PersonalInfo {
    return (
      !!value &&
      typeof value === 'object' &&
      'nombre' in value &&
      typeof value.nombre === 'string' &&
      'apellido' in value &&
      typeof value.apellido === 'string' &&
      'dni' in value &&
      typeof value.dni === 'string' &&
      'telefono' in value &&
      typeof value.telefono === 'string'
    );
  }

  private isDeliveryData(value: unknown): value is DeliveryData | null {
    if (value === null || value === undefined) {
      return true;
    }

    if (!value || typeof value !== 'object' || !('method' in value)) {
      return false;
    }

    if (value.method === 'PICKUP') {
      return true;
    }

    if (value.method !== 'DELIVERY' || !('address' in value)) {
      return false;
    }

    const address = value.address;

    return (
      !!address &&
      typeof address === 'object' &&
      'calle' in address &&
      typeof address.calle === 'string' &&
      'numero' in address &&
      typeof address.numero === 'string' &&
      'localidad' in address &&
      typeof address.localidad === 'string' &&
      'codigoPostal' in address &&
      typeof address.codigoPostal === 'string' &&
      (!('piso' in address) || typeof address.piso === 'string') &&
      (!('departamento' in address) || typeof address.departamento === 'string') &&
      (!('especificaciones' in address) || typeof address.especificaciones === 'string')
    );
  }

  private isCart(value: unknown): value is Cart | null {
    if (value === null || value === undefined) {
      return true;
    }

    if (
      !value ||
      typeof value !== 'object' ||
      !('id' in value) ||
      (value.id !== null && typeof value.id !== 'number') ||
      !('price' in value) ||
      typeof value.price !== 'string' ||
      !('items' in value) ||
      !Array.isArray(value.items)
    ) {
      return false;
    }

    return value.items.every(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        'id' in item &&
        typeof item.id === 'number' &&
        'productId' in item &&
        typeof item.productId === 'number' &&
        'cantidad' in item &&
        typeof item.cantidad === 'number' &&
        'product' in item &&
        this.isProduct(item.product),
    );
  }

  private isProduct(value: unknown): boolean {
    return (
      !!value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'number' &&
      'marca' in value &&
      typeof value.marca === 'string' &&
      'nombre' in value &&
      typeof value.nombre === 'string' &&
      'precio' in value &&
      typeof value.precio === 'string' &&
      'stock' in value &&
      typeof value.stock === 'number' &&
      'imgUrl' in value &&
      (value.imgUrl === null || typeof value.imgUrl === 'string')
    );
  }
}
