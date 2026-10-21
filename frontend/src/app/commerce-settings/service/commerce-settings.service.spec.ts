import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../enviroments/enviroment';
import { CommerceSettingsService } from './commerce-settings.service';

describe('CommerceSettingsService', () => {
  let service: CommerceSettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommerceSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the global minimum purchase amount and service fee', () => {
    service.load();

    const request = http.expectOne(`${environment.apiUrl}/commerce-settings`);
    expect(request.request.method).toBe('GET');
    request.flush({ minimumPurchaseAmount: '10000.00', serviceFee: '500.00' });

    expect(service.settings()).toEqual({
      minimumPurchaseAmount: '10000.00',
      serviceFee: '500.00',
    });
    expect(service.isLoading()).toBe(false);
  });

  it('keeps checkout decisions blocked when settings cannot be loaded', () => {
    service.load();
    http.expectOne(`${environment.apiUrl}/commerce-settings`).flush(
      { message: 'failure' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(service.settings()).toBeNull();
    expect(service.errorMessage()).toContain('No se pudo cargar');
  });
});
