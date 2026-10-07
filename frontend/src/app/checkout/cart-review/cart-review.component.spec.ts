import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Cart } from '../../cart/model/cart.interface';
import { CartService } from '../../cart/service/cart.service';
import { CheckoutService } from '../service/checkout.service';
import { CartReviewComponent } from './cart-review.component';

describe('CartReviewComponent', () => {
  let fixture: ComponentFixture<CartReviewComponent>;
  let component: CartReviewComponent;
  let cartState: ReturnType<typeof signal<Cart | null>>;
  let updateItemCalls: Array<[number, number]>;
  let removeItemCalls: number[];
  let savedCart: Cart | undefined;

  const cart: Cart = {
    id: 1,
    price: '2500.50',
    items: [
      {
        id: 10,
        productId: 2,
        cantidad: 2,
        product: {
          id: 2,
          marca: 'Canasta',
          nombre: 'Arroz',
          precio: '1250.25',
          stock: 4,
          imgUrl: null,
        },
      },
    ],
  };

  beforeEach(async () => {
    cartState = signal<Cart | null>(cart);
    updateItemCalls = [];
    removeItemCalls = [];
    savedCart = undefined;

    const cartService = {
      cart: cartState.asReadonly(),
      getCart: () => of(cart),
      updateItem: (productId: number, cantidad: number) => {
        updateItemCalls.push([productId, cantidad]);
        return of(cart);
      },
      removeItem: (productId: number) => {
        removeItemCalls.push(productId);
        return of({ ...cart, items: [] });
      },
    };
    const checkoutService = {
      updateCart: (value: Cart) => {
        savedCart = value;
      },
    };

    await TestBed.configureTestingModule({
      imports: [CartReviewComponent],
      providers: [
        { provide: CartService, useValue: cartService },
        { provide: CheckoutService, useValue: checkoutService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartReviewComponent);
    component = fixture.componentInstance;
  });

  it('shows the live cart from CartService', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Arroz');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $2500.50');
  });

  it('does not confirm an empty cart', () => {
    cartState.set({ id: null, price: '0.00', items: [] });
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.confirmCart();

    expect(savedCart).toBeUndefined();
    expect(completed).toBe(0);
  });

  it('saves a snapshot and completes when the cart is confirmed', () => {
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.confirmCart();

    expect(savedCart).toBe(cart);
    expect(completed).toBe(1);
  });

  it('delegates quantity changes and removal to CartService', () => {
    component.increaseQuantity(2, 2, 4);
    component.decreaseQuantity(2, 2);
    component.removeItem(2);

    expect(updateItemCalls).toEqual([
      [2, 3],
      [2, 1],
    ]);
    expect(removeItemCalls).toEqual([2]);
  });

  it('always reflects the current live cart instead of an older snapshot', () => {
    fixture.detectChanges();
    cartState.set({ ...cart, price: '1250.25', items: [{ ...cart.items[0], cantidad: 1 }] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cantidad: 1');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $1250.25');
  });
});
