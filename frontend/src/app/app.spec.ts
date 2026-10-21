import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './auth/service/auth.service';
import { routes } from './app.routes';
import { CartService } from './cart/service/cart.service';
import { CommerceSettingsService } from './commerce-settings/service/commerce-settings.service';
import { CheckoutService } from './checkout/service/checkout.service';
import { PedidoService } from './pedido/service/pedido.service';
import { ProductService } from './product/service/product.service';
import { OverlayService } from './ui/overlay.service';

describe('App', () => {
  const authenticatedState = signal(false);
  let logoutCalls: number;
  let overlayService: OverlayService;
  const checkoutData = signal({
    currentStep: 'cart-review' as const,
    cart: null,
    personalInfo: { nombre: '', apellido: '', dni: '', telefono: '' },
    delivery: null,
    payment: null,
  });

  beforeEach(async () => {
    authenticatedState.set(false);
    logoutCalls = 0;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: authenticatedState.asReadonly(),
            getCurrentUser: () => of({ id: 7, nombre: 'Juan', email: 'juan@email.com' }),
            logout: () => {
              logoutCalls++;
              authenticatedState.set(false);
            },
          },
        },
        {
          provide: ProductService,
          useValue: { getProducts: () => of([]) },
        },
        {
          provide: CartService,
          useValue: {
            cart: signal(null).asReadonly(),
            feedback: signal(null).asReadonly(),
            showError: () => undefined,
            clearFeedback: () => undefined,
            addItem: () => of(null),
            getCart: () => of({ id: null, price: '0.00', items: [] }),
            updateItem: () => of({ id: null, price: '0.00', items: [] }),
            removeItem: () => of({ id: null, price: '0.00', items: [] }),
          },
        },
        {
          provide: CommerceSettingsService,
          useValue: {
            settings: signal({ minimumPurchaseAmount: '10000.00', serviceFee: '500.00' }).asReadonly(),
            isLoading: signal(false).asReadonly(),
            errorMessage: signal('').asReadonly(),
            load: () => undefined,
          },
        },
        {
          provide: CheckoutService,
          useValue: {
            checkoutData: checkoutData.asReadonly(),
            updateCart: () => undefined,
            updateStep: () => undefined,
          },
        },
        {
          provide: PedidoService,
          useValue: {
            getPedidos: () => of([]),
            getById: (id: number) =>
              of({
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
    }).compileComponents();

    overlayService = TestBed.inject(OverlayService);
    overlayService.close();
    checkoutData.set({
      currentStep: 'cart-review',
      cart: null,
      personalInfo: { nombre: '', apellido: '', dni: '', telefono: '' },
      delivery: null,
      payment: null,
    });
  });

  const findButton = (element: HTMLElement, label: string): HTMLButtonElement =>
    Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === label,
    ) as HTMLButtonElement;

  it('always shows Mi perfil when there is no session', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Canasta');
    expect(compiled.textContent).toContain('Mi perfil');
    expect(Array.from(compiled.querySelectorAll('button')).map((button) => button.textContent?.trim()))
      .not.toContain('Ingresar');
  });

  it('shows Perfil and Salir in the authenticated dropdown', () => {
    authenticatedState.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Perfil');
    expect(fixture.nativeElement.textContent).toContain('Salir');
    expect(fixture.nativeElement.textContent).not.toContain('Ingresar');
    expect(fixture.nativeElement.textContent).not.toContain('Regístrate');
  });

  it('shows Ingresar and Regístrate in the unauthenticated dropdown', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresar');
    expect(fixture.nativeElement.textContent).toContain('Regístrate');
    expect(fixture.nativeElement.textContent).not.toContain('Perfil');
    expect(fixture.nativeElement.textContent).not.toContain('Salir');
  });

  it('navigates to account from the authenticated dropdown', async () => {
    authenticatedState.set(true);
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();
    findButton(fixture.nativeElement, 'Perfil').click();
    await fixture.whenStable();

    expect(router.url).toBe('/account');
    expect(fixture.componentInstance.isProfileMenuOpen()).toBe(false);
  });

  it('opens Login through OverlayService and closes the dropdown', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();
    findButton(fixture.nativeElement, 'Ingresar').click();
    fixture.detectChanges();

    expect(overlayService.activeOverlay()).toBe('login');
    expect(fixture.componentInstance.isProfileMenuOpen()).toBe(false);
  });

  it('opens Register through OverlayService and closes the dropdown', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();
    findButton(fixture.nativeElement, 'Regístrate').click();
    fixture.detectChanges();

    expect(overlayService.activeOverlay()).toBe('register');
    expect(fixture.componentInstance.isProfileMenuOpen()).toBe(false);
  });

  it('opens and closes the profile dropdown from its button and an outside click', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isProfileMenuOpen()).toBe(true);

    document.body.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isProfileMenuOpen()).toBe(false);
  });

  it('reacts to authentication changes without reloading', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ingresar');

    authenticatedState.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Perfil');
    expect(fixture.nativeElement.textContent).toContain('Salir');
  });

  it('logs out and navigates home from the header', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/checkout');

    fixture.componentInstance.confirmLogout();
    await fixture.whenStable();

    expect(logoutCalls).toBe(1);
    expect(router.url).toBe('/');
  });

  it('opens the existing logout confirmation from the authenticated dropdown', () => {
    authenticatedState.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mi perfil').click();
    fixture.detectChanges();
    findButton(fixture.nativeElement, 'Salir').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.showLogoutConfirmation()).toBe(true);
    expect(fixture.componentInstance.isProfileMenuOpen()).toBe(false);
  });

  it('keeps the header and router outlet without rendering an inactive overlay', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.overlay')).toBeNull();
  });

  it('shows Ver carrito on the home route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ver carrito');
    expect(fixture.nativeElement.textContent).not.toContain('Volver al inicio');
  });

  it('shows Volver al inicio on the checkout route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/checkout');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Volver al inicio');
    expect(fixture.nativeElement.textContent).not.toContain('Ver carrito');
  });

  it('shows Volver al inicio on a pedido route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/pedidos/27');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Volver al inicio');
    expect(fixture.nativeElement.textContent).not.toContain('Ver carrito');
  });

  it('renders login, register and cart from OverlayService', () => {
    const fixture = TestBed.createComponent(App);

    overlayService.openLogin();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login')).not.toBeNull();

    overlayService.openRegister();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-register')).not.toBeNull();

    overlayService.openCart();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-cart')).not.toBeNull();
  });

  it('closes an overlay when its backdrop is clicked', () => {
    const fixture = TestBed.createComponent(App);
    overlayService.openLogin();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.overlay') as HTMLElement).click();
    fixture.detectChanges();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(fixture.nativeElement.querySelector('.overlay')).toBeNull();
  });

  it('opens Cart as an overlay from the header without changing the current route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();

    const cartButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Ver carrito') as HTMLButtonElement;
    cartButton.click();
    fixture.detectChanges();

    expect(overlayService.activeOverlay()).toBe('cart');
    expect(fixture.nativeElement.querySelector('app-cart')).not.toBeNull();
    expect(router.url).toBe('/');
    expect(fixture.nativeElement.querySelector('[routerlink="/cart"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  it('navigates home when Volver al inicio is clicked', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/checkout');
    await fixture.whenStable();
    fixture.detectChanges();

    const homeButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Volver al inicio') as HTMLButtonElement;
    homeButton.click();
    await fixture.whenStable();

    expect(router.url).toBe('/');
  });

  it('updates the header when navigating between home and checkout', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ver carrito');

    await router.navigateByUrl('/checkout');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Volver al inicio');

    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ver carrito');
  });

});
