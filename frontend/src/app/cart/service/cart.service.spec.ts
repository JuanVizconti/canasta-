import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../enviroments/enviroment';
import { Cart } from '../model/cart.interface';
import { CART_MESSAGE_TIMEOUT_MS, CartService } from './cart.service';
import { vi } from 'vitest';

describe('CartService', () => {
  let service: CartService;
  let httpTesting: HttpTestingController;

  const emptyCart: Cart = {
    id: null,
    price: '0.00',
    items: [],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CartService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('gets the cart from GET /cart', () => {
    service.getCart().subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne(`${environment.apiUrl}/cart`);
    expect(request.request.method).toBe('GET');
    request.flush(emptyCart);
  });

  it('adds an item with POST /cart/items', () => {
    service.addItem(11, 2).subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne(`${environment.apiUrl}/cart/items`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ productId: 11, cantidad: 2 });
    request.flush(emptyCart);
  });

  it('updates an item with PATCH /cart/items/:productId', () => {
    service.updateItem(11, 3).subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne(`${environment.apiUrl}/cart/items/11`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ cantidad: 3 });
    request.flush(emptyCart);
  });

  it('removes an item with DELETE /cart/items/:productId', () => {
    service.removeItem(11).subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne(`${environment.apiUrl}/cart/items/11`);
    expect(request.request.method).toBe('DELETE');
    request.flush(emptyCart);
  });

  it('shows a success feedback message and clears it after the configured timeout', () => {
    service.showSuccess('Producto agregado al carrito.');

    expect(service.feedback()).toEqual({
      type: 'success',
      text: 'Producto agregado al carrito.',
    });

    vi.advanceTimersByTime(CART_MESSAGE_TIMEOUT_MS);

    expect(service.feedback()).toBeNull();
  });

  it('shows an error feedback message and clears it after the configured timeout', () => {
    service.showError('No se pudo actualizar el carrito.');

    expect(service.feedback()).toEqual({
      type: 'error',
      text: 'No se pudo actualizar el carrito.',
    });

    vi.advanceTimersByTime(CART_MESSAGE_TIMEOUT_MS);

    expect(service.feedback()).toBeNull();
  });

  it('replaces the previous feedback and restarts its timeout', () => {
    service.showError('No se pudo actualizar el carrito.');
    vi.advanceTimersByTime(2000);

    service.showSuccess('Carrito actualizado.');
    vi.advanceTimersByTime(2000);

    expect(service.feedback()).toEqual({
      type: 'success',
      text: 'Carrito actualizado.',
    });

    vi.advanceTimersByTime(2000);

    expect(service.feedback()).toBeNull();
  });

  it('uses one feedback state so success and error cannot remain visible together', () => {
    service.showSuccess('Producto agregado al carrito.');
    service.showError('No se pudo actualizar el carrito.');

    expect(service.feedback()).toEqual({
      type: 'error',
      text: 'No se pudo actualizar el carrito.',
    });
  });
});
