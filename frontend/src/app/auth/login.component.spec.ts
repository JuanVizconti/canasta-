import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from './service/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let loginResult = of({ accessToken: 'jwt-token' });
  let receivedRequest: unknown;
  let navigationState: { extras: { state: Record<string, unknown> } } | null = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: (request: unknown) => {
              receivedRequest = request;
              return loginResult;
            },
          },
        },
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => navigationState,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('calls AuthService.login and shows success', () => {
    component.email = 'usuario@email.com';
    component.password = '12345678';

    component.submit();

    expect(receivedRequest).toEqual({
      email: 'usuario@email.com',
      password: '12345678',
    });
    expect(component.successMessage()).toBe('Sesión iniciada.');
  });

  it('shows an error when login fails', () => {
    loginResult = throwError(
      () =>
        new HttpErrorResponse({
          status: 401,
          error: { code: 'INVALID_CREDENTIALS' },
        }),
    );

    component.submit();

    expect(component.errorMessage()).toBe('Email o contraseña incorrectos.');
  });

  it('shows an invalid session message after an interceptor redirect', () => {
    navigationState = { extras: { state: { invalidSession: true } } };
    const redirectedFixture = TestBed.createComponent(LoginComponent);

    expect(redirectedFixture.componentInstance.sessionMessage()).toBe(
      'Tu sesión expiró o dejó de ser válida. Iniciá sesión nuevamente.',
    );
  });
});
