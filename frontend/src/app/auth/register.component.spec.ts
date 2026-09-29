import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService } from './service/auth.service';
import { OverlayService } from '../ui/overlay.service';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let registerResult = of({ accessToken: 'jwt-token' });
  let receivedRequest: unknown;
  let navigatedTo: string | undefined;
  let overlayService: OverlayService;

  beforeEach(async () => {
    registerResult = of({ accessToken: 'jwt-token' });
    receivedRequest = undefined;
    navigatedTo = undefined;
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: (request: unknown) => {
              receivedRequest = request;
              return registerResult;
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

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    overlayService = TestBed.inject(OverlayService);
    overlayService.close();
  });

  it('calls AuthService.register and shows success', () => {
    component.usuario = 'Usuario';
    component.email = 'usuario@email.com';
    component.password = '12345678';

    component.submit();

    expect(receivedRequest).toEqual({
      usuario: 'Usuario',
      email: 'usuario@email.com',
      password: '12345678',
    });
    expect(component.successMessage()).toBe('Registro exitoso.');
  });

  it('shows an error when registration fails', () => {
    registerResult = throwError(() => new Error('Registration failed'));

    component.submit();

    expect(component.errorMessage()).toBe('No se pudo completar el registro.');
  });

  it('switches to login through OverlayService', () => {
    overlayService.openRegister();

    component.goToLogin();

    expect(overlayService.activeOverlay()).toBe('login');
    expect(navigatedTo).toBeUndefined();
  });

  it('closes the overlay after successful register and automatic login', () => {
    overlayService.openRegister();
    component.submit();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(navigatedTo).toBeUndefined();
  });

  it('preserves the login overlay returnUrl through register and returns there after success', () => {
    overlayService.openLogin('/checkout', 'invalid-session');
    overlayService.openRegister();

    expect(overlayService.loginReason()).toBe('invalid-session');

    component.goToLogin();
    expect(overlayService.loginReason()).toBe('invalid-session');

    overlayService.openRegister();

    component.submit();

    expect(overlayService.activeOverlay()).toBeNull();
    expect(overlayService.returnUrl()).toBeNull();
    expect(overlayService.loginReason()).toBe('manual');
    expect(navigatedTo).toBe('/checkout');
  });

  it('does not close the overlay if registration fails', () => {
    overlayService.openLogin('/checkout');
    overlayService.openRegister();
    registerResult = throwError(() => new Error('Registration failed'));

    component.submit();

    expect(overlayService.activeOverlay()).toBe('register');
    expect(overlayService.returnUrl()).toBe('/checkout');
  });
});
