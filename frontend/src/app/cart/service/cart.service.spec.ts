import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Cart } from '../model/cart.interface';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;
  let httpTesting: HttpTestingController;

  const emptyCart: Cart = {
    id: null,
    price: '0.00',
    items: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CartService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets the cart from GET /cart', () => {
    service.getCart().subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne('http://localhost:3000/cart');
    expect(request.request.method).toBe('GET');
    request.flush(emptyCart);
  });

  it('adds an item with POST /cart/items', () => {
    service.addItem(11, 2).subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne('http://localhost:3000/cart/items');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ productId: 11, cantidad: 2 });
    request.flush(emptyCart);
  });

  it('updates an item with PATCH /cart/items/:productId', () => {
    service.updateItem(11, 3).subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne('http://localhost:3000/cart/items/11');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ cantidad: 3 });
    request.flush(emptyCart);
  });

  it('removes an item with DELETE /cart/items/:productId', () => {
    service.removeItem(11).subscribe((cart) => expect(cart).toEqual(emptyCart));

    const request = httpTesting.expectOne('http://localhost:3000/cart/items/11');
    expect(request.request.method).toBe('DELETE');
    request.flush(emptyCart);
  });
});
