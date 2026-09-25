import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Cart } from '../../cart/model/cart.interface';
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
});
