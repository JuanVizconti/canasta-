import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CheckoutData, PaymentData } from '../model/checkout.interface';
import { CheckoutService } from '../service/checkout.service';
import { PaymentComponent } from './payment.component';

describe('PaymentComponent', () => {
  let fixture: ComponentFixture<PaymentComponent>;
  let component: PaymentComponent;
  let checkoutData: ReturnType<typeof signal<CheckoutData>>;
  let savedPayments: PaymentData[];

  const createCheckoutData = (payment: PaymentData | null): CheckoutData => ({
    currentStep: 'payment',
    personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
    delivery: { method: 'PICKUP' },
    cart: null,
    payment,
  });

  beforeEach(async () => {
    checkoutData = signal(createCheckoutData(null));
    savedPayments = [];

    await TestBed.configureTestingModule({
      imports: [PaymentComponent],
      providers: [
        {
          provide: CheckoutService,
          useValue: {
            checkoutData: checkoutData.asReadonly(),
            updatePayment: (payment: PaymentData) => {
              savedPayments.push(payment);
              checkoutData.update((current) => ({ ...current, payment }));
            },
          },
        },
      ],
    }).compileComponents();
  });

  const createComponent = (): void => {
    fixture = TestBed.createComponent(PaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('starts without a selected method when payment is null', () => {
    createComponent();

    expect(component.selectedMethod()).toBeNull();
  });

  it('restores CASH from checkout data', () => {
    checkoutData.set(createCheckoutData({ method: 'CASH' }));
    createComponent();

    expect(component.selectedMethod()).toBe('CASH');
  });

  it('restores MERCADO_PAGO from checkout data', () => {
    checkoutData.set(createCheckoutData({ method: 'MERCADO_PAGO' }));
    createComponent();

    expect(component.selectedMethod()).toBe('MERCADO_PAGO');
  });

  it('persists CASH when selected', () => {
    createComponent();

    component.selectMethod('CASH');

    expect(savedPayments).toEqual([{ method: 'CASH' }]);
    expect(checkoutData().currentStep).toBe('payment');
  });

  it('persists MERCADO_PAGO when selected', () => {
    createComponent();

    component.selectMethod('MERCADO_PAGO');

    expect(savedPayments).toEqual([{ method: 'MERCADO_PAGO' }]);
  });

  it('does not complete without a selected method', () => {
    createComponent();
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.continue();

    expect(completed).toBe(0);
    expect(savedPayments).toEqual([]);
  });

  it('persists and completes with a selected method', () => {
    createComponent();
    let completed = 0;
    component.completed.subscribe(() => completed++);
    component.selectMethod('CASH');

    component.continue();

    expect(completed).toBe(1);
    expect(savedPayments).toEqual([{ method: 'CASH' }, { method: 'CASH' }]);
  });

  it('emits back without changing the checkout step', () => {
    createComponent();
    let back = 0;
    component.back.subscribe(() => back++);

    component.goBack();

    expect(back).toBe(1);
    expect(checkoutData().currentStep).toBe('payment');
  });
});
