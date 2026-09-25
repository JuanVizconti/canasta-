import { TestBed } from '@angular/core/testing';
import { Cart } from '../../cart/model/cart.interface';
import { CheckoutData, DeliveryData, PersonalInfo } from '../model/checkout.interface';
import { CheckoutStorageService } from './checkout-storage.service';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let savedData: CheckoutData[];
  let clearCalls: number;

  const personalInfo: PersonalInfo = {
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
  };
  const delivery: DeliveryData = { method: 'PICKUP' };
  const cart: Cart = {
    id: 1,
    price: '2500.50',
    items: [
      {
        id: 1,
        productId: 1,
        cantidad: 2,
        product: {
          id: 1,
          marca: 'Canasta',
          nombre: 'Producto',
          precio: '1250.25',
          stock: 5,
          imgUrl: null,
        },
      },
    ],
  };

  const initialData = (): CheckoutData => ({
    currentStep: 'cart-review',
    personalInfo: { nombre: '', apellido: '', dni: '', telefono: '' },
    delivery: null,
    cart: null,
    payment: null,
  });

  beforeEach(() => {
    savedData = [];
    clearCalls = 0;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: CheckoutStorageService,
          useValue: {
            load: () => initialData(),
            save: (data: CheckoutData) => savedData.push(data),
            clear: () => clearCalls++,
          },
        },
      ],
    });

    service = TestBed.inject(CheckoutService);
  });

  it('initializes its state from CheckoutStorageService', () => {
    expect(service.checkoutData()).toEqual(initialData());
  });

  it('updates personal information and preserves delivery and cart', () => {
    service.updateDelivery(delivery);
    service.updateCart(cart);
    service.updatePersonalInfo(personalInfo);

    expect(service.checkoutData()).toEqual({
      currentStep: 'cart-review',
      personalInfo,
      delivery,
      cart,
      payment: null,
    });
    expect(savedData.at(-1)).toEqual(service.checkoutData());
  });

  it('updates delivery and preserves personal information and cart', () => {
    service.updatePersonalInfo(personalInfo);
    service.updateCart(cart);
    const updatedDelivery: DeliveryData = {
      method: 'DELIVERY',
      address: {
        calle: 'Siempre Viva',
        numero: '123',
        localidad: 'Springfield',
        codigoPostal: '1000',
      },
    };

    service.updateDelivery(updatedDelivery);

    expect(service.checkoutData()).toEqual({
      currentStep: 'cart-review',
      personalInfo,
      delivery: updatedDelivery,
      cart,
      payment: null,
    });
    expect(savedData.at(-1)).toEqual(service.checkoutData());
  });

  it('updates a cart snapshot and preserves the other checkout data', () => {
    const cartToSnapshot: Cart = {
      ...cart,
      items: [{ ...cart.items[0], product: { ...cart.items[0].product } }],
    };
    service.updatePersonalInfo(personalInfo);
    service.updateDelivery(delivery);
    service.updateCart(cartToSnapshot);
    cartToSnapshot.items[0].cantidad = 4;

    expect(service.checkoutData()).toEqual({
      currentStep: 'cart-review',
      personalInfo,
      delivery,
      cart,
      payment: null,
    });
    expect(savedData.at(-1)).toEqual(service.checkoutData());
  });

  it('updates the step and preserves the rest of checkout data', () => {
    service.updatePersonalInfo(personalInfo);
    service.updateDelivery(delivery);
    service.updateCart(cart);

    service.updateStep('delivery');

    expect(service.checkoutData()).toEqual({
      currentStep: 'delivery',
      personalInfo,
      delivery,
      cart,
      payment: null,
    });
    expect(savedData.at(-1)).toEqual(service.checkoutData());
  });

  it('updates payment and preserves the rest of checkout data', () => {
    service.updatePersonalInfo(personalInfo);
    service.updateDelivery(delivery);
    service.updateCart(cart);
    service.updateStep('payment');

    service.updatePayment({ method: 'MERCADO_PAGO' });

    expect(service.checkoutData()).toEqual({
      currentStep: 'payment',
      personalInfo,
      delivery,
      cart,
      payment: { method: 'MERCADO_PAGO' },
    });
    expect(savedData.at(-1)).toEqual(service.checkoutData());
  });

  it('clears the storage and restores the initial state', () => {
    service.updatePersonalInfo(personalInfo);
    service.updateDelivery(delivery);
    service.updateCart(cart);
    service.updatePayment({ method: 'CASH' });

    service.clearCheckout();

    expect(clearCalls).toBe(1);
    expect(service.checkoutData()).toEqual(initialData());
  });
});
