import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('logs in and stores the access token', () => {
    const requestBody = { email: 'usuario@email.com', password: '12345678' };

    service.login(requestBody).subscribe();

    const request = httpTesting.expectOne('http://localhost:3000/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush({ accessToken: 'jwt-token' });

    expect(localStorage.getItem('accessToken')).toBe('jwt-token');
  });

  it('registers, logs in with the same credentials, and stores the token', () => {
    const requestBody = {
      usuario: 'Usuario',
      email: 'usuario@email.com',
      password: '12345678',
    };

    service.register(requestBody).subscribe();

    const registerRequest = httpTesting.expectOne('http://localhost:3000/users');
    expect(registerRequest.request.method).toBe('POST');
    expect(registerRequest.request.body).toEqual(requestBody);
    registerRequest.flush({ id: 1, usuario: requestBody.usuario, email: requestBody.email });

    const loginRequest = httpTesting.expectOne('http://localhost:3000/auth/login');
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual({
      email: requestBody.email,
      password: requestBody.password,
    });
    loginRequest.flush({ accessToken: 'registered-jwt-token' });

    expect(localStorage.getItem('accessToken')).toBe('registered-jwt-token');
  });

  it('does not log in when registration fails', () => {
    service.register({
      usuario: 'Usuario',
      email: 'usuario@email.com',
      password: '12345678',
    }).subscribe({ error: () => undefined });

    const registerRequest = httpTesting.expectOne('http://localhost:3000/users');
    registerRequest.flush({}, { status: 400, statusText: 'Bad Request' });

    httpTesting.expectNone('http://localhost:3000/auth/login');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('removes the access token when logging out', () => {
    localStorage.setItem('accessToken', 'jwt-token');

    service.logout();

    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});
