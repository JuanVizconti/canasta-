import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Cart } from '../../cart/model/cart.interface';
import { CartService } from '../../cart/service/cart.service';
import { CreatedPedido } from '../../pedido/model/create-pedido.interface';
import { PedidoQuote } from '../../pedido/model/pedido-quote.interface';
import { PedidoService } from '../../pedido/service/pedido.service';
import { CheckoutData } from '../model/checkout.interface';
import { CheckoutService } from '../service/checkout.service';
import { ConfirmationComponent } from './confirmation.component';

describe('ConfirmationComponent', () => {
  let fixture: ComponentFixture<ConfirmationComponent>;
  let component: ConfirmationComponent;
  let checkoutData: ReturnType<typeof signal<CheckoutData>>;
  let quoteCalls: string[];
  let quoteResponse: Observable<PedidoQuote>;
  let createResponse: Observable<CreatedPedido>;
  let createCalls: unknown[];
  let refreshedCart: Cart | undefined;
  let navigatedTo: unknown[] | undefined;
  let navigationExtras: unknown;

  const cart: Cart = {
    id: 1,
    price: '1.00',
    items: [
      {
        id: 1,
        productId: 3,
        cantidad: 2,
        product: {
          id: 3,
          marca: 'Canasta',
          nombre: 'Arroz',
          precio: '1500.00',
          stock: 5,
          imgUrl: null,
        },
      },
    ],
  };
  const quote: PedidoQuote = {
    subtotal: '20000.00',
    serviceFee: '500.00',
    deliveryFee: '2000.00',
    total: '22500.00',
  };
  const createCheckoutData = (delivery: CheckoutData['delivery']): CheckoutData => ({
    currentStep: 'confirmation',
    cart,
    personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
    delivery,
    payment: { method: 'MERCADO_PAGO' },
  });

  beforeEach(async () => {
    checkoutData = signal(createCheckoutData({
      method: 'DELIVERY',
      address: {
        calle: 'Siempre Viva',
        numero: '123',
        localidad: 'Springfield',
        codigoPostal: '1000',
      },
    }));
    quoteCalls = [];
    quoteResponse = of(quote);
    createCalls = [];
    refreshedCart = undefined;
    navigatedTo = undefined;
    navigationExtras = undefined;
    createResponse = of({
      id: 27,
      estado: 'CONFIRMED',
      total: '22500.00',
      payment: { method: 'CASH', status: 'PENDING', checkoutUrl: null },
    });

    await TestBed.configureTestingModule({
      imports: [ConfirmationComponent],
      providers: [
        { provide: CheckoutService, useValue: { checkoutData: checkoutData.asReadonly() } },
        {
          provide: PedidoService,
          useValue: {
            quote: (deliveryMethod: string) => {
              quoteCalls.push(deliveryMethod);
              return quoteResponse;
            },
            create: (request: unknown) => {
              createCalls.push(request);
              return createResponse;
            },
          },
        },
        {
          provide: CartService,
          useValue: {
            getCart: () => {
              const emptyCart = { id: 1, price: '0.00', items: [] };
              refreshedCart = emptyCart;
              return of(emptyCart);
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[], extras?: unknown) => {
              navigatedTo = commands;
              navigationExtras = extras;
              return Promise.resolve(true);
            },
          },
        },
      ],
    }).compileComponents();
  });

  const createComponent = (): void => {
    fixture = TestBed.createComponent(ConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('loads a DELIVERY quote and renders the read-only checkout snapshot', () => {
    createComponent();

    expect(quoteCalls).toEqual(['DELIVERY']);
    expect(fixture.nativeElement.textContent).toContain('Arroz');
    expect(fixture.nativeElement.textContent).toContain('Cantidad: 2');
    expect(fixture.nativeElement.textContent).toContain('Juan Perez');
    expect(fixture.nativeElement.textContent).toContain('Siempre Viva 123');
    expect(fixture.nativeElement.textContent).toContain('Mercado Pago');
    expect(fixture.nativeElement.textContent).toContain('Total: $22500.00');
    expect(fixture.nativeElement.textContent).not.toContain('Piso:');
    expect(fixture.nativeElement.textContent).not.toContain('Departamento:');
    expect(fixture.nativeElement.textContent).not.toContain('Eliminar');
  });

  it('loads a PICKUP quote and displays CASH as Efectivo', () => {
    checkoutData.set({
      ...createCheckoutData({ method: 'PICKUP' }),
      payment: { method: 'CASH' },
    });
    createComponent();

    expect(quoteCalls).toEqual(['PICKUP']);
    expect(fixture.nativeElement.textContent).toContain('Retiro por el local');
    expect(fixture.nativeElement.textContent).toContain('Efectivo');
  });

  it('shows loading while the quote is pending', () => {
    quoteResponse = new Subject<PedidoQuote>();
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Calculando total...');
  });

  it('does not request a quote when delivery is missing', () => {
    checkoutData.set(createCheckoutData(null));
    createComponent();

    expect(quoteCalls).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No encontramos un método de entrega');
  });

  it('shows the minimum purchase error explicitly', () => {
    quoteResponse = throwError(() => ({
      error: {
        code: 'MINIMUM_PURCHASE_NOT_REACHED',
        message: 'El monto mínimo de compra es de $10.000',
      },
    }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('El monto mínimo de compra es de $10.000');
  });

  it('shows a generic error and retries the quote', () => {
    quoteResponse = throwError(() => ({ error: { code: 'OTHER' } }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No pudimos calcular el total del pedido');
    component.loadQuote();
    expect(quoteCalls).toEqual(['DELIVERY', 'DELIVERY']);
  });

  it('emits back without changing checkout data', () => {
    createComponent();
    let back = 0;
    component.back.subscribe(() => back++);

    component.goBack();

    expect(back).toBe(1);
    expect(checkoutData().currentStep).toBe('confirmation');
  });

  it('shows only Confirmar pedido for CASH and navigates to the persisted pedido', () => {
    checkoutData.set({ ...createCheckoutData({ method: 'PICKUP' }), payment: { method: 'CASH' } });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Confirmar pedido');
    expect(fixture.nativeElement.textContent).not.toContain('Ir a pagar');

    component.confirmCashOrder();
    component.confirmCashOrder();

    expect(createCalls).toEqual([{
      personalInfo: checkoutData().personalInfo,
      delivery: { method: 'PICKUP' },
      paymentMethod: 'CASH',
    }]);
    expect(refreshedCart).toEqual({ id: 1, price: '0.00', items: [] });
    expect(navigatedTo).toEqual(['/pedidos', 27]);
    expect(fixture.nativeElement.textContent).not.toContain('Pedido creado correctamente');
  });

  it('shows only Ir a pagar for MERCADO_PAGO and does not create a pedido', () => {
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Ir a pagar');
    expect(fixture.nativeElement.textContent).not.toContain('Confirmar pedido');
    expect(createCalls).toEqual([]);
  });

  it('creates a Mercado Pago pedido and redirects when the payment link is ready', () => {
    createResponse = of({
      id: 27,
      estado: 'PENDING',
      total: '22500.00',
      payment: {
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        checkoutUrl: 'https://mercadopago.example/checkout/27',
      },
      paymentInitialization: { status: 'READY' },
    });
    createComponent();
    const redirect = vi.spyOn(component, 'redirectToCheckout').mockImplementation(() => undefined);

    component.confirmMercadoPagoOrder();

    expect(createCalls).toEqual([{
      personalInfo: checkoutData().personalInfo,
      delivery: {
        method: 'DELIVERY',
        address: {
          calle: 'Siempre Viva',
          numero: '123',
          localidad: 'Springfield',
          codigoPostal: '1000',
        },
      },
      paymentMethod: 'MERCADO_PAGO',
    }]);
    expect(refreshedCart).toEqual({ id: 1, price: '0.00', items: [] });
    expect(redirect).toHaveBeenCalledWith('https://mercadopago.example/checkout/27');
    expect(navigatedTo).toBeUndefined();
  });

  it('navigates to the persisted pedido when Mercado Pago does not return a payment link', () => {
    createResponse = of({
      id: 27,
      estado: 'PENDING',
      total: '22500.00',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
      paymentInitialization: { status: 'FAILED' },
    });
    createComponent();
    const redirect = vi.spyOn(component, 'redirectToCheckout').mockImplementation(() => undefined);

    component.confirmMercadoPagoOrder();

    expect(createCalls).toHaveLength(1);
    expect(redirect).not.toHaveBeenCalled();
    expect(navigatedTo).toEqual(['/pedidos', 27]);
    expect(navigationExtras).toEqual({ state: { paymentLinkError: true } });
  });

  it('keeps checkout open when creating the Mercado Pago pedido fails', () => {
    createResponse = throwError(() => ({ error: { code: 'INSUFFICIENT_STOCK' } }));
    createComponent();
    const redirect = vi.spyOn(component, 'redirectToCheckout').mockImplementation(() => undefined);

    component.confirmMercadoPagoOrder();

    expect(component.creationErrorMessage()).toContain('stock suficiente');
    expect(navigatedTo).toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('prevents duplicate Mercado Pago pedido creation while submitting', () => {
    createResponse = new Subject<CreatedPedido>();
    createComponent();

    component.confirmMercadoPagoOrder();
    component.confirmMercadoPagoOrder();

    expect(createCalls).toHaveLength(1);
    expect(component.isSubmitting()).toBe(true);
  });

  it('shows semantic creation errors and allows retrying', () => {
    checkoutData.set({ ...createCheckoutData({ method: 'PICKUP' }), payment: { method: 'CASH' } });
    createResponse = throwError(() => ({ error: { code: 'INSUFFICIENT_STOCK' } }));
    createComponent();

    component.confirmCashOrder();
    expect(component.creationErrorMessage()).toContain('stock suficiente');
    expect(component.isSubmitting()).toBe(false);

    component.confirmCashOrder();
    expect(createCalls).toHaveLength(2);
  });
});
