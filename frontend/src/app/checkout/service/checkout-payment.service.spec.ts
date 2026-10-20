import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../enviroments/enviroment';
import { CheckoutPaymentService } from './checkout-payment.service';

describe('CheckoutPaymentService', () => {
  let service: CheckoutPaymentService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CheckoutPaymentService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('initializes Mercado Pago from checkout data only', () => {
    const checkout = {
      personalInfo: {
        nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455',
      },
      delivery: { method: 'PICKUP' as const },
    };

    service.initializeMercadoPago(checkout).subscribe((response) => {
      expect(response).toEqual({ checkoutUrl: 'https://mercadopago.example/checkout/20' });
    });

    const request = httpTesting.expectOne(`${environment.apiUrl}/checkout/mercado-pago`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(checkout);
    expect(request.request.body).not.toHaveProperty('paymentMethod');
    request.flush({ checkoutUrl: 'https://mercadopago.example/checkout/20' });
  });

  it('gets the status of a checkout snapshot', () => {
    service.getSnapshotStatus(20).subscribe((response) => {
      expect(response).toEqual({ status: 'COMPLETED', pedidoId: 84 });
    });

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/checkout-snapshots/20/status`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush({ status: 'COMPLETED', pedidoId: 84 });
  });
});
