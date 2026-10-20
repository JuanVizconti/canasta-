import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { AuthService } from '../auth/service/auth.service';
import { Cart } from '../cart/model/cart.interface';
import { CartService } from '../cart/service/cart.service';
import { Product } from './model/product.interface';
import { ProductListComponent } from './product-list.component';
import { ProductService } from './service/product.service';

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let component: ProductListComponent;
  let cartState: ReturnType<typeof signal<Cart | null>>;
  let authenticatedState: ReturnType<typeof signal<boolean>>;
  let addItemCalls: Array<[number, number]>;
  let updateItemCalls: Array<[number, number]>;
  let removeItemCalls: number[];
  let getCartCalls: number;

  const product: Product = {
    id: 1,
    marca: 'Coca-Cola',
    nombre: 'Coca-Cola 2.25L',
    precio: '2500.50',
    stock: 10,
    imgUrl: null,
  };

  const emptyCart = (): Cart => ({ id: 1, price: '0.00', items: [] });

  const cartWithQuantity = (cantidad: number): Cart => ({
    id: 1,
    price: (Number(product.precio) * cantidad).toFixed(2),
    items: [
      {
        id: 10,
        productId: product.id,
        cantidad,
        product,
      },
    ],
  });

  const buttonByLabel = (label: string): HTMLButtonElement =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === label,
    ) as HTMLButtonElement;

  beforeEach(async () => {
    cartState = signal<Cart | null>(emptyCart());
    authenticatedState = signal(true);
    addItemCalls = [];
    updateItemCalls = [];
    removeItemCalls = [];
    getCartCalls = 0;

    const cartService = {
      cart: cartState.asReadonly(),
      getCart: () => {
        getCartCalls++;
        return of(cartState() ?? emptyCart());
      },
      addItem: (productId: number, cantidad: number) => {
        addItemCalls.push([productId, cantidad]);
        const updatedCart = cartWithQuantity(cantidad);
        cartState.set(updatedCart);
        return of(updatedCart);
      },
      updateItem: (productId: number, cantidad: number) => {
        updateItemCalls.push([productId, cantidad]);
        const updatedCart = cartWithQuantity(cantidad);
        cartState.set(updatedCart);
        return of(updatedCart);
      },
      removeItem: (productId: number) => {
        removeItemCalls.push(productId);
        const updatedCart = emptyCart();
        cartState.set(updatedCart);
        return of(updatedCart);
      },
    };

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        {
          provide: ProductService,
          useValue: { getProducts: () => of([product]) },
        },
        { provide: CartService, useValue: cartService },
        {
          provide: AuthService,
          useValue: { isAuthenticated: authenticatedState.asReadonly() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only + Agregar when the product is not in the cart', () => {
    expect(component.products()).toEqual([product]);
    expect(buttonByLabel('+ Agregar')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Agregar al carrito');
  });

  it('creates the cart item with quantity one and then shows its real quantity', () => {
    component.addToCart(product);
    fixture.detectChanges();

    expect(addItemCalls).toEqual([[product.id, 1]]);
    expect(component.cartItemFor(product.id)?.cantidad).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('1');
    expect(buttonByLabel('+ Agregar')).toBeFalsy();
  });

  it('uses the live cart item quantity and updates it absolutely when increasing', () => {
    cartState.set(cartWithQuantity(3));
    fixture.detectChanges();

    component.increaseQuantity(product);

    expect(fixture.nativeElement.textContent).toContain('3');
    expect(updateItemCalls).toEqual([[product.id, 4]]);
  });

  it('decreases an existing cart item and removes it when its quantity is one', () => {
    cartState.set(cartWithQuantity(2));
    component.decreaseQuantity(product);
    expect(updateItemCalls).toEqual([[product.id, 1]]);

    component.decreaseQuantity(product);
    fixture.detectChanges();
    expect(removeItemCalls).toEqual([product.id]);
    expect(buttonByLabel('+ Agregar')).toBeTruthy();
  });

  it('does not increase or send a request when the cart item already reaches stock', () => {
    cartState.set(cartWithQuantity(product.stock));
    fixture.detectChanges();

    expect(buttonByLabel('+').disabled).toBe(true);
    component.increaseQuantity(product);
    expect(updateItemCalls).toEqual([]);
  });

  it('does not allow adding an out-of-stock product', () => {
    const outOfStockProduct = { ...product, id: 2, stock: 0 };
    component.products.set([outOfStockProduct]);
    fixture.detectChanges();

    expect(buttonByLabel('+ Agregar').disabled).toBe(true);
    component.addToCart(outOfStockProduct);
    expect(addItemCalls).toEqual([]);
  });

  it('keeps delegating an unauthenticated add attempt to CartService', () => {
    authenticatedState.set(false);
    cartState.set(cartWithQuantity(2));
    fixture.detectChanges();

    expect(buttonByLabel('+ Agregar')).toBeTruthy();
    component.addToCart(product);

    expect(addItemCalls).toEqual([[product.id, 1]]);
  });

  it('disables controls for a product while its request is pending', () => {
    const pendingResponse = new Subject<Cart>();
    const cartService = TestBed.inject(CartService) as unknown as {
      addItem: (productId: number, cantidad: number) => Subject<Cart>;
    };
    cartService.addItem = (productId, cantidad) => {
      addItemCalls.push([productId, cantidad]);
      return pendingResponse;
    };

    component.addToCart(product);
    fixture.detectChanges();

    expect(buttonByLabel('+ Agregar').disabled).toBe(true);
    component.addToCart(product);
    expect(addItemCalls).toEqual([[product.id, 1]]);

    pendingResponse.next(cartWithQuantity(1));
    pendingResponse.complete();
    fixture.detectChanges();
    expect(component.isProductPending(product.id)).toBe(false);
  });

  it('reflects an external CartService update without reloading products', () => {
    cartState.set(cartWithQuantity(5));
    fixture.detectChanges();

    expect(component.cartItemFor(product.id)?.cantidad).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('5');
  });

  it('loads the live cart for an authenticated product list', () => {
    expect(getCartCalls).toBe(1);
  });
});
