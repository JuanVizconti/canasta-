import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './auth/service/auth.service';
import { routes } from './app.routes';
import { CartService } from './cart/service/cart.service';
import { ProductService } from './product/service/product.service';

describe('App', () => {
  const authenticatedState = signal(false);
  let logoutCalls: number;

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
            addItem: () => of(null),
          },
        },
      ],
    }).compileComponents();
  });

  it('creates the app and shows account links when there is no session', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.toggleAccountMenu();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Canasta');
    expect(compiled.textContent).toContain('Iniciar sesión');
    expect(compiled.textContent).toContain('Registrarse');
  });

  it('shows logout when there is an active session', () => {
    authenticatedState.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.toggleAccountMenu();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cerrar sesión');
  });

  it('logs out and navigates home from the header', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');

    fixture.componentInstance.logout();
    await fixture.whenStable();

    expect(logoutCalls).toBe(1);
    expect(router.url).toBe('/');
  });
});
