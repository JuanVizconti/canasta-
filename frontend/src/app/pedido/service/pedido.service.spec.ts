import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PedidoQuote } from '../model/pedido-quote.interface';
import { CreatePedidoRequest, CreatedPedido } from '../model/create-pedido.interface';
import { Pedido } from '../model/pedido.interface';
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

  it('creates a pedido without sending cart or quote values', () => {
    const body: CreatePedidoRequest = {
      personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
      delivery: { method: 'PICKUP' },
      paymentMethod: 'CASH',
    };
    const response: CreatedPedido = {
      id: 27,
      estado: 'CONFIRMED',
      total: '20500.00',
      payment: { method: 'CASH', status: 'PENDING' },
    };

    service.create(body).subscribe((pedido) => expect(pedido).toEqual(response));

    const request = httpTesting.expectOne('http://localhost:3000/pedidos');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.body).not.toHaveProperty('cart');
    expect(request.request.body).not.toHaveProperty('quote');
    request.flush(response);
  });

  it('gets a persisted pedido by id without adding Authorization manually', () => {
    const pedido: Pedido = {
      id: 27,
      estado: 'CONFIRMED',
      createdAt: '2026-09-28T18:30:00.000Z',
      personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
      delivery: { method: 'PICKUP' },
      items: [],
      subtotal: '20000.00',
      serviceFee: '500.00',
      deliveryFee: '0.00',
      total: '20500.00',
      payment: { method: 'CASH', status: 'PENDING' },
    };

    service.getById(27).subscribe((response) => expect(response).toEqual(pedido));

    const request = httpTesting.expectOne('http://localhost:3000/pedidos/27');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(pedido);
  });
});
