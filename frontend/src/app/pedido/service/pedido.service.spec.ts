import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PedidoQuote } from '../model/pedido-quote.interface';
import { PedidoService } from './pedido.service';

describe('PedidoService', () => {
  let service: PedidoService;
  let httpTesting: HttpTestingController;

  const quote: PedidoQuote = {
    subtotal: '20000.00',
    serviceFee: '500.00',
    deliveryFee: '2000.00',
    total: '22500.00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PedidoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('quotes PICKUP with the exact request body', () => {
    service.quote('PICKUP').subscribe((response) => expect(response).toEqual(quote));

    const request = httpTesting.expectOne('http://localhost:3000/pedidos/quote');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ deliveryMethod: 'PICKUP' });
    request.flush(quote);
  });

  it('quotes DELIVERY with the exact request body', () => {
    service.quote('DELIVERY').subscribe((response) => expect(response).toEqual(quote));

    const request = httpTesting.expectOne('http://localhost:3000/pedidos/quote');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ deliveryMethod: 'DELIVERY' });
    request.flush(quote);
  });
});
