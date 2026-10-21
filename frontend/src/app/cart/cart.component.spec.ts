import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { NEVER, Observable, of, tap } from 'rxjs';
import { AuthService } from '../auth/service/auth.service';
import { CommerceSettings } from '../commerce-settings/model/commerce-settings.interface';
import { Cart } from './model/cart.interface';
import { CartComponent } from './cart.component';
import { CartService } from './service/cart.service';
import { CommerceSettingsService } from '../commerce-settings/service/commerce-settings.service';
import { OverlayService } from '../ui/overlay.service';

describe('CartComponent', () => {
  let fixture: ComponentFixture<CartComponent>;
  let component: CartComponent;
  let getCartResult: Observable<Cart>;
  let addItemResult: Observable<Cart>;
  let updateItemResult: Observable<Cart>;
  let removeItemResult: Observable<Cart>;
  let getCartCalls: number;
  let navigatedTo: string | undefined;
  const cartState = signal<Cart | null>(null);
  const authenticatedState = signal(true);
  const commerceSettingsState = signal<CommerceSettings | null>({
    minimumPurchaseAmount: '10000.00',
    serviceFee: '500.00',
  });
  const commerceSettingsLoadingState = signal(false);
  const commerceSettingsErrorState = signal('');

  const emptyCart: Cart = { id: null, price: '0.00', items: [] };
  const cartWithItems: Cart = {
    id: 16,
    price: '10001.00',
    items: [
      {
        id: 22,
        productId: 11,
        cantidad: 2,
        product: {
          id: 11,
          marca: 'Coca-Cola',
          nombre: 'Coca-Cola 2.25L',
          precio: '5000.50',
          stock: 10,
          imgUrl: null,
        },
      },
    ],
  };

  beforeEach(async () => {
    getCartResult = NEVER;
    addItemResult = of(cartWithItems);
    updateItemResult = of(cartWithItems);
    removeItemResult = of(emptyCart);
    getCartCalls = 0;
    navigatedTo = undefined;
    cartState.set(null);
    authenticatedState.set(true);
    commerceSettingsState.set({ minimumPurchaseAmount: '10000.00', serviceFee: '500.00' });
    commerceSettingsLoadingState.set(false);
    commerceSettingsErrorState.set('');

    await TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [
        {
          provide: CartService,
          useValue: {
            cart: cartState.asReadonly(),
            feedback: signal(null).asReadonly(),
            showError: () => undefined,
            clearFeedback: () => undefined,
            getCart: () => {
              getCartCalls++;
              return getCartResult.pipe(tap((cart) => cartState.set(cart)));
            },
            addItem: () => addItemResult.pipe(tap((cart) => cartState.set(cart))),
            updateItem: () => updateItemResult.pipe(tap((cart) => cartState.set(cart))),
            removeItem: () => removeItemResult.pipe(tap((cart) => cartState.set(cart))),
          },
        },
        {
          provide: AuthService,
          useValue: { isAuthenticated: authenticatedState.asReadonly() },
        },
        {
          provide: CommerceSettingsService,
          useValue: {
            settings: commerceSettingsState.asReadonly(),
            isLoading: commerceSettingsLoadingState.asReadonly(),
            errorMessage: commerceSettingsErrorState.asReadonly(),
            load: () => undefined,
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: (url: string) => {
              navigatedTo = url;
              return Promise.resolve(true);
            },
            navigate: (commands: string[]) => {
              navigatedTo = commands[0];
              return Promise.resolve(true);
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartComponent);
    component = fixture.componentInstance;
  });

  it('starts with a null cart and shows the loading state', () => {
    expect(component.cart()).toBeNull();

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando carrito...');
  });

  it('loads an empty cart and shows the empty state', () => {
    getCartResult = of(emptyCart);

    fixture.detectChanges();

    expect(component.cart()).toEqual(emptyCart);
    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío.');
  });

  it('does not request the cart when there is no active session', () => {
    authenticatedState.set(false);

    fixture.detectChanges();

    expect(getCartCalls).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      'Iniciá sesión para agregar productos al carrito.',
    );
  });

  it('loads a cart with items for the template', () => {
    getCartResult = of(cartWithItems);

    fixture.detectChanges();

    expect(component.cart()).toEqual(cartWithItems);
    expect(fixture.nativeElement.textContent).toContain('Coca-Cola 2.25L');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $10001.00');
    expect(fixture.nativeElement.textContent).toContain('Costo de servicio: $500.00');
    expect(fixture.nativeElement.textContent).toContain('Total: $10501.00');
    expect(fixture.nativeElement.textContent).toContain('Continuar con la compra');
  });

  it('does not show checkout navigation for an empty cart', () => {
    getCartResult = of(emptyCart);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Continuar con la compra');
  });

  it('closes the cart overlay and navigates to checkout when continuing with items', () => {
    getCartResult = of(cartWithItems);
    fixture.detectChanges();
    const overlayService = TestBed.inject(OverlayService);
    overlayService.openCart();

    component.continueToCheckout();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(navigatedTo).toBe('/checkout');
  });

  it('blocks checkout and shows the missing amount below the configured minimum', () => {
    commerceSettingsState.set({ minimumPurchaseAmount: '11000.00', serviceFee: '500.00' });
    getCartResult = of(cartWithItems);

    fixture.detectChanges();
    component.continueToCheckout();

    expect(fixture.nativeElement.textContent).toContain('Compra mínima: $11000.00');
    expect(fixture.nativeElement.textContent).toContain('Te faltan: $999.00');
    expect(navigatedTo).toBeUndefined();
  });

  it('allows checkout at the exact configured minimum', () => {
    getCartResult = of({ ...cartWithItems, price: '10000.00' });

    fixture.detectChanges();

    expect(component.canContinueToCheckout()).toBe(true);
    const checkoutButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Continuar con la compra') as HTMLButtonElement;
    expect(checkoutButton.disabled).toBe(false);
  });

  it('blocks checkout while commercial settings are unavailable', () => {
    commerceSettingsState.set(null);
    commerceSettingsErrorState.set('No se pudo cargar la configuración comercial.');
    getCartResult = of(cartWithItems);

    fixture.detectChanges();

    expect(component.canContinueToCheckout()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar la configuración comercial.');
  });

  it('closes the overlay without navigating', () => {
    const overlayService = TestBed.inject(OverlayService);
    overlayService.openCart();

    component.close();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(navigatedTo).toBeUndefined();
  });

  it('updates the cart signal after changing an item quantity', () => {
    fixture.detectChanges();
    const updatedCart: Cart = { ...cartWithItems, price: '7501.50' };
    updateItemResult = of(updatedCart);

    component.updateItem(11, 3);

    expect(component.cart()).toEqual(updatedCart);
  });

  it('updates the cart signal after removing an item', () => {
    fixture.detectChanges();

    component.removeItem(11);

    expect(component.cart()).toEqual(emptyCart);
  });
});
