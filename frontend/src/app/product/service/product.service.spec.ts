import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Product } from '../model/product.interface';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProductService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets products from GET /products', () => {
    const products: Product[] = [
      {
        id: 1,
        marca: 'Coca-Cola',
        nombre: 'Coca-Cola 2.25L',
        precio: '2500.50',
        stock: 10,
        imgUrl: null,
      },
    ];

    service.getProducts().subscribe((response) => {
      expect(response).toEqual(products);
    });

    const request = httpTesting.expectOne('http://localhost:3000/products');
    expect(request.request.method).toBe('GET');
    request.flush(products);
  });
});
