import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import {
  CheckoutPaymentService,
  CheckoutSnapshotStatusResponse,
} from '../service/checkout-payment.service';
import { CartService } from '../../cart/service/cart.service';
import { CheckoutService } from '../service/checkout.service';
import { CheckoutSuccessComponent } from './checkout-success.component';

describe('CheckoutSuccessComponent', () => {
  let fixture: ComponentFixture<CheckoutSuccessComponent>;
  let component: CheckoutSuccessComponent;
  let snapshotId: string | null;
  let response: Observable<CheckoutSnapshotStatusResponse>;
  let getStatusCalls: number[];
  let refreshCartCalls: number;
  let clearCheckoutCalls: number;
  let navigatedTo: unknown[] | undefined;

  beforeEach(async () => {
    snapshotId = '15';
    response = of({ status: 'ACTIVE', pedidoId: null });
    getStatusCalls = [];
    refreshCartCalls = 0;
    clearCheckoutCalls = 0;
    navigatedTo = undefined;

    await TestBed.configureTestingModule({
      imports: [CheckoutSuccessComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: { queryParamMap: convertToParamMap({ snapshotId }) },
          }),
        },
        {
          provide: CheckoutPaymentService,
          useValue: {
            getSnapshotStatus: (id: number) => {
              getStatusCalls.push(id);
              return response;
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[]) => {
              navigatedTo = commands;
              return Promise.resolve(true);
            },
          },
        },
        {
          provide: CartService,
          useValue: {
            getCart: () => {
              refreshCartCalls += 1;
              return of({ id: 12, price: '0.00', items: [] });
            },
          },
        },
        {
          provide: CheckoutService,
          useValue: {
            clearCheckout: () => {
              clearCheckoutCalls += 1;
            },
          },
        },
      ],
    }).compileComponents();
  });

  const createComponent = (): void => {
    fixture = TestBed.createComponent(CheckoutSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('loads the snapshot status once when a valid id is present', () => {
    createComponent();

    expect(getStatusCalls).toEqual([15]);
    expect(fixture.nativeElement.textContent).toContain('Estamos procesando tu pago');
  });

  it('shows ACTIVE and refreshes only when the user asks to update', () => {
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Actualizar estado');
    component.refreshStatus();

    expect(getStatusCalls).toEqual([15, 15]);
    expect(refreshCartCalls).toBe(0);
    expect(clearCheckoutCalls).toBe(0);
  });

  it('refreshes the cart and clears completed checkout state once', () => {
    response = of({ status: 'COMPLETED', pedidoId: 84 });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Pago confirmado');
    expect(fixture.nativeElement.textContent).toContain('Tu pedido fue creado correctamente.');
    expect(refreshCartCalls).toBe(1);
    expect(clearCheckoutCalls).toBe(1);

    component.refreshStatus();

    expect(refreshCartCalls).toBe(1);
    expect(clearCheckoutCalls).toBe(1);
  });

  it('refreshes the cart when a manual refresh changes ACTIVE to COMPLETED', () => {
    createComponent();

    response = of({ status: 'COMPLETED', pedidoId: 84 });
    component.refreshStatus();

    expect(getStatusCalls).toEqual([15, 15]);
    expect(refreshCartCalls).toBe(1);
    expect(clearCheckoutCalls).toBe(1);
  });

  it('shows the completed message and navigates to its persisted pedido', () => {
    response = of({ status: 'COMPLETED', pedidoId: 84 });
    createComponent();

    component.followPedido();
    expect(navigatedTo).toEqual(['/pedidos', 84]);
  });

  it.each([
    ['FAILED', 'No pudimos completar el pago.'],
    ['EXPIRED', 'Esta sesión de pago expiró.'],
  ] as const)('shows the message for %s', (status, message) => {
    response = of({ status, pedidoId: null });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain(message);
    expect(refreshCartCalls).toBe(0);
    expect(clearCheckoutCalls).toBe(0);
  });

  it('shows a request error and retries manually', () => {
    response = throwError(() => new Error('network failure'));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No pudimos consultar el estado del pago.');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');

    component.refreshStatus();
    expect(getStatusCalls).toEqual([15, 15]);
    expect(refreshCartCalls).toBe(0);
    expect(clearCheckoutCalls).toBe(0);
  });

  it.each([null, '0', '-1', 'invalid'])('does not call the backend for invalid snapshot id %s', (id) => {
    snapshotId = id;
    createComponent();

    expect(getStatusCalls).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No pudimos identificar el pago.');
  });
});
