import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Cart } from '../cart/model/cart.interface';
import { CartService } from '../cart/service/cart.service';
import { PedidoService } from '../pedido/service/pedido.service';
import { CheckoutComponent } from './checkout.component';
import { CheckoutData } from './model/checkout.interface';
import { CheckoutService } from './service/checkout.service';

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let component: CheckoutComponent;
  let checkoutData: ReturnType<typeof signal<CheckoutData>>;

  const cart: Cart = {
    id: 1,
    price: '100.00',
    items: [
      {
        id: 1,
        productId: 1,
        cantidad: 1,
        product: {
          id: 1,
          marca: 'Canasta',
          nombre: 'Producto',
          precio: '100.00',
          stock: 10,
          imgUrl: null,
        },
      },
    ],
  };

  const personalInfo = {
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
  };

  beforeEach(async () => {
    checkoutData = signal({
      currentStep: 'cart-review' as const,
      personalInfo: { ...personalInfo },
      delivery: null,
      cart: null,
      payment: null,
    });

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        {
          provide: CheckoutService,
          useValue: {
            checkoutData: checkoutData.asReadonly(),
            updatePersonalInfo: () => undefined,
            updateDelivery: () => undefined,
            updateCart: () => undefined,
            updatePayment: () => undefined,
            updateStep: (currentStep: CheckoutData['currentStep']) =>
              checkoutData.update((current) => ({ ...current, currentStep })),
          },
        },
        {
          provide: CartService,
          useValue: {
            cart: signal(cart).asReadonly(),
            getCart: () => of(cart),
            updateItem: () => of(cart),
            removeItem: () => of(cart),
          },
        },
        {
          provide: PedidoService,
          useValue: {
            quote: () => of({ subtotal: '0.00', serviceFee: '0.00', deliveryFee: '0.00', total: '0.00' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
  });

  it('starts at cart review', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.checkoutData().currentStep).toBe('cart-review');
    expect(fixture.nativeElement.textContent).toContain('Revisá tu carrito');
  });

  it('moves to personal information after cart review is completed', async () => {
    component.goToPersonalInfo();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.checkoutData().currentStep).toBe('personal-info');
    expect((fixture.nativeElement.querySelector('#checkout-nombre') as HTMLInputElement).value).toBe(
      'Juan',
    );
  });

  it('moves to delivery after personal information is completed', () => {
    component.goToDelivery();
    fixture.detectChanges();

    expect(component.checkoutData().currentStep).toBe('delivery');
    expect(fixture.nativeElement.textContent).toContain('Método de entrega');
  });

  it('moves to payment after delivery is completed', () => {
    component.goToPayment();
    fixture.detectChanges();

    expect(component.checkoutData().currentStep).toBe('payment');
    expect(fixture.nativeElement.textContent).toContain('Método de pago');
  });

  it('returns from payment to delivery', () => {
    component.goToPayment();
    component.goToDelivery();

    expect(component.checkoutData().currentStep).toBe('delivery');
  });

  it('moves from payment to confirmation and returns to payment', () => {
    component.goToPayment();
    component.goToConfirmation();
    fixture.detectChanges();

    expect(component.checkoutData().currentStep).toBe('confirmation');
    expect(fixture.nativeElement.textContent).toContain('Confirmar compra');

    component.goToPayment();
    expect(component.checkoutData().currentStep).toBe('payment');
  });


  it('returns from personal information to cart review', () => {
    component.goToPersonalInfo();
    component.goToCartReview();

    expect(component.checkoutData().currentStep).toBe('cart-review');
  });

  it('returns from delivery to personal information', () => {
    component.goToDelivery();
    component.goToPersonalInfo();

    expect(component.checkoutData().currentStep).toBe('personal-info');
  });

  it('renders delivery when the stored current step is delivery', () => {
    checkoutData.update((current) => ({ ...current, currentStep: 'delivery' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Método de entrega');
  });

  it('renders confirmation when the stored current step is confirmation', () => {
    checkoutData.update((current) => ({ ...current, currentStep: 'confirmation' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Confirmar compra');
  });

});
