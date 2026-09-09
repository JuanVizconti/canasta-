import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './service/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let logoutCalls: number;
  let navigation: { commands: unknown[]; extras: unknown } | undefined;

  beforeEach(() => {
    localStorage.clear();
    logoutCalls = 0;
    navigation = undefined;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { logout: () => logoutCalls++ },
        },
        {
          provide: Router,
          useValue: {
            url: '/cart',
            navigate: (commands: unknown[], extras: unknown) => {
              navigation = { commands, extras };
              return Promise.resolve(true);
            },
          },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('adds Authorization when an access token exists', () => {
    localStorage.setItem('accessToken', 'jwt-token');

    http.get('/products').subscribe();

    const request = httpTesting.expectOne('/products');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    request.flush([]);
  });

  it('leaves the request without Authorization when no token exists', () => {
    http.get('/products').subscribe();

    const request = httpTesting.expectOne('/products');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('logs out and redirects to login for INVALID_SESSION', () => {
    http.get('/cart').subscribe({ error: () => undefined });

    const request = httpTesting.expectOne('/cart');
    request.flush(
      { code: 'INVALID_SESSION', message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(logoutCalls).toBe(1);
    expect(navigation).toEqual({
      commands: ['/login'],
      extras: { state: { invalidSession: true, returnUrl: '/cart' } },
    });
  });

  it('does not log out for INVALID_CREDENTIALS', () => {
    http.post('/auth/login', {}).subscribe({ error: () => undefined });

    const request = httpTesting.expectOne('/auth/login');
    request.flush(
      { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(logoutCalls).toBe(0);
    expect(navigation).toBeUndefined();
  });
});
