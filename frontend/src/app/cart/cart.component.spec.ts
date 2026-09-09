import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { NEVER, Observable, of, tap } from 'rxjs';
import { AuthService } from '../auth/service/auth.service';
import { Cart } from './model/cart.interface';
import { CartComponent } from './cart.component';
import { CartService } from './service/cart.service';

describe('CartComponent', () => {
  let fixture: ComponentFixture<CartComponent>;
  let component: CartComponent;
  let getCartResult: Observable<Cart>;
  let addItemResult: Observable<Cart>;
  let updateItemResult: Observable<Cart>;
  let removeItemResult: Observable<Cart>;
  let getCartCalls: number;
  const cartState = signal<Cart | null>(null);
  const authenticatedState = signal(true);

  const emptyCart: Cart = { id: null, price: '0.00', items: [] };
  const cartWithItems: Cart = {
    id: 16,
    price: '5001.00',
    items: [
      {
        id: 22,
        productId: 11,
        cantidad: 2,
        product: {
          id: 11,
          marca: 'Coca-Cola',
          nombre: 'Coca-Cola 2.25L',
          precio: '2500.50',
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
    cartState.set(null);
    authenticatedState.set(true);

    await TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [
        {
          provide: CartService,
          useValue: {
            cart: cartState.asReadonly(),
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
          provide: Router,
          useValue: { navigateByUrl: () => Promise.resolve(true) },
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
    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío.');
    expect(fixture.nativeElement.textContent).toContain('Iniciá sesión para agregar productos.');
  });

  it('loads a cart with items for the template', () => {
    getCartResult = of(cartWithItems);

    fixture.detectChanges();

    expect(component.cart()).toEqual(cartWithItems);
    expect(fixture.nativeElement.textContent).toContain('Coca-Cola 2.25L');
    expect(fixture.nativeElement.textContent).toContain('Precio total: $5001.00');
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
