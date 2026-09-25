import { TestBed } from '@angular/core/testing';
import { Cart } from '../../cart/model/cart.interface';
import { CheckoutData, DeliveryData, PersonalInfo } from '../model/checkout.interface';
import { CheckoutStorageService } from './checkout-storage.service';

describe('CheckoutStorageService', () => {
  let service: CheckoutStorageService;

  const personalInfo: PersonalInfo = {
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
  };
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
  const initialData: CheckoutData = {
    currentStep: 'cart-review',
    personalInfo: { nombre: '', apellido: '', dni: '', telefono: '' },
    delivery: null,
    cart: null,
    payment: null,
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CheckoutStorageService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns initial checkout data when storage is empty', () => {
    expect(service.load()).toEqual(initialData);
  });

  it('restores valid checkout data including a cart snapshot', () => {
    const data: CheckoutData = {
      currentStep: 'cart-review',
      personalInfo,
      delivery: { method: 'PICKUP' },
      cart,
      payment: null,
    };
    sessionStorage.setItem('checkout', JSON.stringify(data));

    expect(service.load()).toEqual(data);
  });

  it('restores CASH payment data', () => {
    sessionStorage.setItem(
      'checkout',
      JSON.stringify({
        currentStep: 'payment',
        personalInfo,
        delivery: null,
        cart: null,
        payment: { method: 'CASH' },
      }),
    );

    expect(service.load().payment).toEqual({ method: 'CASH' });
  });

  it('restores MERCADO_PAGO payment data', () => {
    sessionStorage.setItem(
      'checkout',
      JSON.stringify({
        currentStep: 'payment',
        personalInfo,
        delivery: null,
        cart: null,
        payment: { method: 'MERCADO_PAGO' },
      }),
    );

    expect(service.load().payment).toEqual({ method: 'MERCADO_PAGO' });
  });

  it('restores delivery to a domicile', () => {
    const delivery: DeliveryData = {
      method: 'DELIVERY',
      address: {
        calle: 'Siempre Viva',
        numero: '123',
        localidad: 'Springfield',
        codigoPostal: '1000',
        especificaciones: 'Tocar timbre B',
      },
    };
    sessionStorage.setItem(
      'checkout',
      JSON.stringify({ currentStep: 'delivery', personalInfo, delivery, cart: null, payment: null }),
    );

    expect(service.load()).toEqual({
      currentStep: 'delivery',
      personalInfo,
      delivery,
      cart: null,
      payment: null,
    });
  });

  it('handles corrupt JSON without throwing', () => {
    sessionStorage.setItem('checkout', '{invalid-json');

    expect(service.load()).toEqual(initialData);
  });

  it('rejects incompatible runtime data', () => {
    sessionStorage.setItem('checkout', JSON.stringify({ personalInfo, delivery: { method: 'OTHER' } }));

    expect(service.load()).toEqual(initialData);
  });

  it('supports older valid data without a cart', () => {
    sessionStorage.setItem('checkout', JSON.stringify({ personalInfo, delivery: null }));

    expect(service.load()).toEqual({
      currentStep: 'cart-review',
      personalInfo,
      delivery: null,
      cart: null,
      payment: null,
    });
  });

  it('supports older valid data without payment', () => {
    sessionStorage.setItem(
      'checkout',
      JSON.stringify({ currentStep: 'payment', personalInfo, delivery: null, cart: null }),
    );

    expect(service.load()).toEqual({
      currentStep: 'payment',
      personalInfo,
      delivery: null,
      cart: null,
      payment: null,
    });
  });

  it('rejects invalid payment data', () => {
    sessionStorage.setItem(
      'checkout',
      JSON.stringify({
        currentStep: 'payment',
        personalInfo,
        delivery: null,
        cart: null,
        payment: { method: 'CARD' },
      }),
    );

    expect(service.load()).toEqual(initialData);
  });

  it('restores every supported checkout step', () => {
    const steps: CheckoutData['currentStep'][] = [
      'cart-review',
      'personal-info',
      'delivery',
      'payment',
      'confirmation',
    ];

    for (const currentStep of steps) {
      sessionStorage.setItem(
        'checkout',
        JSON.stringify({ currentStep, personalInfo, delivery: null, cart: null, payment: null }),
      );

      expect(service.load().currentStep).toBe(currentStep);
    }
  });

  it('rejects an invalid current step', () => {
    sessionStorage.setItem(
      'checkout',
      JSON.stringify({ currentStep: 'unknown-step', personalInfo, delivery: null, cart: null, payment: null }),
    );

    expect(service.load()).toEqual(initialData);
  });

  it('saves checkout data', () => {
    const data: CheckoutData = {
      currentStep: 'personal-info',
      personalInfo,
      delivery: null,
      cart,
      payment: null,
    };

    service.save(data);

    expect(sessionStorage.getItem('checkout')).toBe(JSON.stringify(data));
  });

  it('clears persisted checkout data', () => {
    service.save({ currentStep: 'payment', personalInfo, delivery: null, cart, payment: null });

    service.clear();

    expect(sessionStorage.getItem('checkout')).toBeNull();
  });
});
