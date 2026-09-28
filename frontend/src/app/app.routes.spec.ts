import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { AuthService } from './auth/service/auth.service';
import { CartComponent } from './cart/cart.component';
import { CartService } from './cart/service/cart.service';
import { CheckoutComponent } from './checkout/checkout.component';
import { CheckoutService } from './checkout/service/checkout.service';
import { PedidoComponent } from './pedido/pedido.component';
import { PedidoService } from './pedido/service/pedido.service';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: signal(false).asReadonly(),
            login: () => of({ accessToken: 'jwt-token' }),
            register: () => of({ accessToken: 'jwt-token' }),
          },
        },
        {
          provide: CartService,
          useValue: {
            cart: signal(null).asReadonly(),
            getCart: () => of({ id: null, price: '0.00', items: [] }),
          },
        },
        {
          provide: CheckoutService,
          useValue: {
            checkoutData: signal({
              currentStep: 'cart-review' as const,
              personalInfo: { nombre: '', apellido: '', dni: '', telefono: '' },
              delivery: null,
              cart: null,
              payment: null,
            }).asReadonly(),
          },
        },
        {
          provide: PedidoService,
          useValue: {
            getById: (id: number) => of({
              id,
              estado: 'CONFIRMED',
              createdAt: '2026-09-28T18:30:00.000Z',
              personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
              delivery: { method: 'PICKUP' },
              items: [],
              subtotal: '20000.00',
              serviceFee: '500.00',
              deliveryFee: '0.00',
              total: '20500.00',
              payment: { method: 'CASH', status: 'PENDING' },
            }),
          },
        },
      ],
    });
  });

  it('loads LoginComponent at /login', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/login', LoginComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Iniciar sesión');
  });

  it('loads RegisterComponent at /register', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/register', RegisterComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Registrarse');
  });

  it('loads CartComponent at /cart', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cart', CartComponent);

    expect(harness.routeNativeElement?.textContent).toContain(
      'Iniciá sesión para agregar productos al carrito.',
    );
  });

  it('loads CheckoutComponent at /checkout', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/checkout', CheckoutComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Revisá tu carrito');
  });

  it('loads PedidoComponent at /pedidos/:id', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/pedidos/27', PedidoComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Pedido #27');
  });
});
