import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { Cart } from '../../cart/model/cart.interface';
import { CartService } from '../../cart/service/cart.service';
import { CommerceSettings } from '../../commerce-settings/model/commerce-settings.interface';
import { CommerceSettingsService } from '../../commerce-settings/service/commerce-settings.service';
import { CheckoutService } from '../service/checkout.service';
import { CartReviewComponent } from './cart-review.component';

describe('CartReviewComponent', () => {
  let fixture: ComponentFixture<CartReviewComponent>;
  let component: CartReviewComponent;
  let cartState: ReturnType<typeof signal<Cart | null>>;
  let updateItemCalls: Array<[number, number]>;
  let removeItemCalls: number[];
  let checkoutCartUpdates: Cart[];
  const commerceSettingsState = signal<CommerceSettings | null>({
    minimumPurchaseAmount: '10000.00',
    serviceFee: '500.00',
  });
  const commerceSettingsLoadingState = signal(false);
  const commerceSettingsErrorState = signal('');

  const cartWithQuantity = (cantidad: number): Cart => ({
    id: 1,
    price: (6000 * cantidad).toFixed(2),
    items: cantidad === 0
      ? []
      : [
          {
            id: 10,
            productId: 2,
            cantidad,
            product: {
              id: 2,
              marca: 'Canasta',
              nombre: 'Arroz',
              precio: '6000.00',
              stock: 4,
              imgUrl: null,
            },
          },
        ],
  });

  beforeEach(async () => {
    cartState = signal<Cart | null>(cartWithQuantity(2));
    updateItemCalls = [];
    removeItemCalls = [];
    checkoutCartUpdates = [];
    commerceSettingsState.set({ minimumPurchaseAmount: '10000.00', serviceFee: '500.00' });
    commerceSettingsLoadingState.set(false);
    commerceSettingsErrorState.set('');

    const cartService = {
      cart: cartState.asReadonly(),
      feedback: signal(null).asReadonly(),
      showError: () => undefined,
      clearFeedback: () => undefined,
      getCart: () => of(cartState() ?? cartWithQuantity(0)),
      updateItem: (productId: number, cantidad: number) => {
        updateItemCalls.push([productId, cantidad]);
        const updatedCart = cartWithQuantity(cantidad);
        cartState.set(updatedCart);
        return of(updatedCart);
      },
      removeItem: (productId: number) => {
        removeItemCalls.push(productId);
        const updatedCart = cartWithQuantity(0);
        cartState.set(updatedCart);
        return of(updatedCart);
      },
    };
    const checkoutService = {
      updateCart: (cart: Cart) => checkoutCartUpdates.push(cart),
    };

    await TestBed.configureTestingModule({
      imports: [CartReviewComponent],
      providers: [
        { provide: CartService, useValue: cartService },
        { provide: CheckoutService, useValue: checkoutService },
        {
          provide: CommerceSettingsService,
          useValue: {
            settings: commerceSettingsState.asReadonly(),
            isLoading: commerceSettingsLoadingState.asReadonly(),
            errorMessage: commerceSettingsErrorState.asReadonly(),
            load: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartReviewComponent);
    component = fixture.componentInstance;
  });

  it('shows the live cart quantity and subtotal from CartService', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Arroz');
    expect(fixture.nativeElement.textContent).toContain('2');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $12000.00');
    expect(fixture.nativeElement.textContent).toContain('Costo de servicio: $500.00');
    expect(fixture.nativeElement.textContent).toContain('Total parcial: $12500.00');
    expect(fixture.nativeElement.textContent).not.toContain('Eliminar');
  });

  it('does not confirm an empty cart', () => {
    cartState.set(cartWithQuantity(0));
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.confirmCart();

    expect(checkoutCartUpdates).toEqual([]);
    expect(completed).toBe(0);
  });

  it('saves a snapshot and completes when the cart is confirmed', () => {
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.confirmCart();

    expect(checkoutCartUpdates).toEqual([cartWithQuantity(2)]);
    expect(completed).toBe(1);
  });

  it('updates the real cart, subtotal, and checkout snapshot when increasing or decreasing', () => {
    component.increaseQuantity(2, 2, 4);
    component.decreaseQuantity(2, 3);
    fixture.detectChanges();

    expect(updateItemCalls).toEqual([
      [2, 3],
      [2, 2],
    ]);
    expect(checkoutCartUpdates).toEqual([cartWithQuantity(3), cartWithQuantity(2)]);
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $12000.00');
  });

  it('removes an item when decreasing quantity one and prevents checkout when it was the last item', () => {
    cartState.set(cartWithQuantity(1));
    component.decreaseQuantity(2, 1);
    fixture.detectChanges();

    expect(removeItemCalls).toEqual([2]);
    expect(checkoutCartUpdates).toEqual([cartWithQuantity(0)]);
    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío.');
  });

  it('does not increase or request above available stock', () => {
    cartState.set(cartWithQuantity(4));
    fixture.detectChanges();

    const plusButton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '+',
    ) as HTMLButtonElement;
    expect(plusButton.disabled).toBe(true);
    component.increaseQuantity(2, 4, 4);
    expect(updateItemCalls).toEqual([]);
  });

  it('prevents overlapping operations for the same item', () => {
    const pendingResponse = new Subject<Cart>();
    const cartService = TestBed.inject(CartService) as unknown as {
      updateItem: (productId: number, cantidad: number) => Subject<Cart>;
    };
    cartService.updateItem = (productId, cantidad) => {
      updateItemCalls.push([productId, cantidad]);
      return pendingResponse;
    };

    component.increaseQuantity(2, 2, 4);
    component.increaseQuantity(2, 2, 4);

    expect(updateItemCalls).toEqual([[2, 3]]);
    pendingResponse.next(cartWithQuantity(3));
    pendingResponse.complete();
    expect(component.isProductPending(2)).toBe(false);
  });

  it('always reflects the current live cart instead of an older checkout snapshot', () => {
    fixture.detectChanges();
    cartState.set(cartWithQuantity(1));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $6000.00');
  });

  it('blocks confirmation below the configured minimum without replacing the snapshot', () => {
    cartState.set(cartWithQuantity(1));
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.confirmCart();

    expect(checkoutCartUpdates).toEqual([]);
    expect(completed).toBe(0);
  });

  it('allows confirmation at the exact configured minimum', () => {
    cartState.set({ ...cartWithQuantity(2), price: '10000.00' });
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.confirmCart();

    expect(checkoutCartUpdates).toEqual([{ ...cartWithQuantity(2), price: '10000.00' }]);
    expect(completed).toBe(1);
  });

  it('re-evaluates the minimum after quantity changes in the live cart', () => {
    component.decreaseQuantity(2, 2);
    expect(component.canConfirmCart()).toBe(false);

    component.increaseQuantity(2, 1, 4);
    expect(component.canConfirmCart()).toBe(true);
  });
});
