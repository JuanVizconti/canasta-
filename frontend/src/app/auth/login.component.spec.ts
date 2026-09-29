import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from './service/auth.service';
import { OverlayService } from '../ui/overlay.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let loginResult = of({ accessToken: 'jwt-token' });
  let receivedRequest: unknown;
  let navigatedTo: string | undefined;
  let overlayService: OverlayService;

  beforeEach(async () => {
    loginResult = of({ accessToken: 'jwt-token' });
    receivedRequest = undefined;
    navigatedTo = undefined;
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
            navigateByUrl: (url: string) => {
              navigatedTo = url;
              return Promise.resolve(true);
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    overlayService = TestBed.inject(OverlayService);
    overlayService.close();
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

  it('does not show the invalid-session message for a manual login', () => {
    overlayService.openLogin();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'Tu sesión ya no es válida. Iniciá sesión nuevamente.',
    );
  });

  it('shows the invalid-session message when the overlay has that context', () => {
    overlayService.openLogin('/checkout', 'invalid-session');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Tu sesión ya no es válida. Iniciá sesión nuevamente.',
    );
  });

  it('switches to register through OverlayService', () => {
    overlayService.openLogin();

    component.goToRegister();

    expect(overlayService.activeOverlay()).toBe('register');
    expect(navigatedTo).toBeUndefined();
  });

  it('closes the overlay after a successful login', () => {
    overlayService.openLogin(undefined, 'invalid-session');
    component.submit();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(overlayService.loginReason()).toBe('manual');
    expect(navigatedTo).toBeUndefined();
  });

  it('returns to the saved overlay returnUrl after a successful login', () => {
    overlayService.openLogin('/checkout', 'invalid-session');

    component.submit();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(overlayService.returnUrl()).toBeNull();
    expect(overlayService.loginReason()).toBe('manual');
    expect(navigatedTo).toBe('/checkout');
  });

  it('uses the safe fallback for an invalid overlay returnUrl', () => {
    overlayService.openLogin('https://external.example');

    component.submit();

    expect(navigatedTo).toBe('/');
  });

  it('does not close the overlay after invalid credentials or a generic error', () => {
    overlayService.openLogin('/checkout', 'invalid-session');
    loginResult = throwError(() => new HttpErrorResponse({ status: 401, error: { code: 'INVALID_CREDENTIALS' } }));
    component.submit();
    expect(overlayService.activeOverlay()).toBe('login');
    expect(overlayService.returnUrl()).toBe('/checkout');
    expect(overlayService.loginReason()).toBe('manual');

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Tu sesión ya no es válida. Iniciá sesión nuevamente.',
    );

    loginResult = throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'OTHER' } }));
    component.submit();
    expect(overlayService.activeOverlay()).toBe('login');
    expect(overlayService.returnUrl()).toBe('/checkout');
  });
});
