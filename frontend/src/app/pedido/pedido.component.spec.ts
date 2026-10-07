import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Pedido } from './model/pedido.interface';
import { PedidoService } from './service/pedido.service';
import { PedidoComponent } from './pedido.component';

describe('PedidoComponent', () => {
  let fixture: ComponentFixture<PedidoComponent>;
  let component: PedidoComponent;
  let routeId: string | null;
  let getByIdCalls: number[];
  let response: Observable<Pedido>;
  let retryPaymentCalls: number[];
  let retryPaymentResponse: Observable<unknown>;

  const pedido: Pedido = {
    id: 27,
    estado: 'CONFIRMED',
    createdAt: '2026-09-28T18:30:00.000Z',
    personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
    delivery: {
      method: 'DELIVERY',
      address: {
        calle: 'Rivadavia', numero: '1234', localidad: 'Castelar', codigoPostal: '1712',
        piso: null, departamento: null, especificaciones: null,
      },
    },
    items: [{ productId: 11, nombre: 'Coca-Cola 2.25L', marca: 'Coca-Cola', cantidad: 2, unitPrice: '2500.50' }],
    subtotal: '20000.00',
    serviceFee: '500.00',
    deliveryFee: '2000.00',
    total: '22500.00',
    payment: { method: 'CASH', status: 'PENDING', checkoutUrl: null },
  };

  beforeEach(async () => {
    routeId = '27';
    getByIdCalls = [];
    response = of(pedido);
    retryPaymentCalls = [];
    retryPaymentResponse = of({
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

    await TestBed.configureTestingModule({
      imports: [PedidoComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useFactory: () => ({ snapshot: { paramMap: convertToParamMap({ id: routeId }) } }),
        },
        {
          provide: PedidoService,
          useValue: {
            getById: (id: number) => {
              getByIdCalls.push(id);
              return response;
            },
            retryPayment: (id: number) => {
              retryPaymentCalls.push(id);
              return retryPaymentResponse;
            },
          },
        },
      ],
    }).compileComponents();
  });

  const createComponent = () => {
    fixture = TestBed.createComponent(PedidoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('reads the route id, loads the persisted pedido and renders its snapshot', () => {
    createComponent();

    expect(getByIdCalls).toEqual([27]);
    expect(fixture.nativeElement.textContent).toContain('Pedido #27');
    expect(fixture.nativeElement.textContent).toContain('Confirmado');
    expect(fixture.nativeElement.textContent).toContain('Efectivo');
    expect(fixture.nativeElement.textContent).toContain('Pendiente');
    expect(fixture.nativeElement.textContent).toContain('Coca-Cola 2.25L');
    expect(fixture.nativeElement.textContent).toContain('Marca: Coca-Cola');
    expect(fixture.nativeElement.textContent).toContain('Precio unitario: $2500.50');
    expect(fixture.nativeElement.textContent).toContain('Juan Perez');
    expect(fixture.nativeElement.textContent).toContain('Rivadavia 1234');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $20000.00');
    expect(fixture.nativeElement.textContent).toContain('Total: $22500.00');
    expect(fixture.nativeElement.textContent).not.toContain('Piso:');
  });

  it('shows loading while the request is pending', () => {
    response = new Subject<Pedido>();
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Cargando pedido...');
  });

  it('renders PICKUP without address and handles null payment', () => {
    response = of({ ...pedido, delivery: { method: 'PICKUP' }, payment: null });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Retiro');
    expect(fixture.nativeElement.textContent).toContain('Sin información de pago');
    expect(fixture.nativeElement.textContent).not.toContain('Rivadavia');
  });

  it('renders Mercado Pago and approved status from persisted values', () => {
    response = of({
      ...pedido,
      payment: { method: 'MERCADO_PAGO', status: 'APPROVED', checkoutUrl: null },
    });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Mercado Pago');
    expect(fixture.nativeElement.textContent).toContain('Aprobado');
    expect(fixture.nativeElement.textContent).not.toContain('Ir a pagar');
  });

  it('redirects directly when a pending Mercado Pago payment already has a checkout URL', () => {
    response = of({
      ...pedido,
      estado: 'PENDING',
      payment: {
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        checkoutUrl: 'https://mercadopago.example/checkout/27',
      },
    });
    createComponent();
    const redirect = vi.spyOn(component, 'redirectToCheckout').mockImplementation(() => undefined);

    component.goToPayment();

    expect(fixture.nativeElement.textContent).toContain('Ir a pagar');
    expect(retryPaymentCalls).toEqual([]);
    expect(redirect).toHaveBeenCalledWith('https://mercadopago.example/checkout/27');
  });

  it('retries a pending Mercado Pago payment without a checkout URL and redirects when ready', () => {
    response = of({
      ...pedido,
      estado: 'PENDING',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
    });
    createComponent();
    const redirect = vi.spyOn(component, 'redirectToCheckout').mockImplementation(() => undefined);

    component.goToPayment();

    expect(retryPaymentCalls).toEqual([27]);
    expect(redirect).toHaveBeenCalledWith('https://mercadopago.example/checkout/27');
  });

  it('keeps the pedido visible when the retry returns FAILED', () => {
    response = of({
      ...pedido,
      estado: 'PENDING',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
    });
    retryPaymentResponse = of({
      id: 27,
      estado: 'PENDING',
      total: '22500.00',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
      paymentInitialization: { status: 'FAILED' },
    });
    createComponent();
    const redirect = vi.spyOn(component, 'redirectToCheckout').mockImplementation(() => undefined);

    component.goToPayment();
    fixture.detectChanges();

    expect(redirect).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'No pudimos generar el link de pago. Intentá nuevamente más tarde.',
    );
  });

  it('shows the expiration message when the backend rejects the retry as expired', () => {
    response = of({
      ...pedido,
      estado: 'PENDING',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
    });
    retryPaymentResponse = throwError(() => ({ error: { code: 'PAYMENT_EXPIRED' } }));
    createComponent();

    component.goToPayment();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'El tiempo para completar este pago expiró.',
    );
  });

  it('prevents duplicate retries while payment initialization is loading', () => {
    response = of({
      ...pedido,
      estado: 'PENDING',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
    });
    retryPaymentResponse = new Subject();
    createComponent();

    component.goToPayment();
    component.goToPayment();
    fixture.detectChanges();

    expect(retryPaymentCalls).toEqual([27]);
    expect(fixture.nativeElement.textContent).toContain('Procesando...');
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not show payment action for a non-pending Mercado Pago pedido', () => {
    response = of({
      ...pedido,
      estado: 'CONFIRMED',
      payment: { method: 'MERCADO_PAGO', status: 'PENDING', checkoutUrl: null },
    });
    createComponent();

    expect(fixture.nativeElement.textContent).not.toContain('Ir a pagar');
  });

  it('shows the not-found error using its semantic code', () => {
    response = throwError(() => ({ error: { code: 'PEDIDO_NOT_FOUND' } }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No encontramos este pedido.');
  });

  it('shows a generic error and retries the same id', () => {
    response = throwError(() => ({ error: { code: 'OTHER' } }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el pedido');
    component.retry();
    expect(getByIdCalls).toEqual([27, 27]);
  });

  it('does not call the backend for an invalid route id', () => {
    routeId = 'not-a-number';
    getByIdCalls = [];
    fixture = TestBed.createComponent(PedidoComponent);
    fixture.detectChanges();

    expect(getByIdCalls).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('El identificador del pedido no es válido.');
  });
});
