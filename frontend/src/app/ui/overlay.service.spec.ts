import { TestBed } from '@angular/core/testing';
import { OverlayService } from './overlay.service';

describe('OverlayService', () => {
  let service: OverlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OverlayService);
  });

  it('starts without an active overlay', () => {
    expect(service.activeOverlay()).toBeNull();
    expect(service.loginReason()).toBe('manual');
  });

  it('opens login, register and cart', () => {
    service.openLogin();
    expect(service.activeOverlay()).toBe('login');
    expect(service.loginReason()).toBe('manual');

    service.openRegister();
    expect(service.activeOverlay()).toBe('register');

    service.openCart();
    expect(service.activeOverlay()).toBe('cart');
  });

  it('replaces the active overlay and closes it', () => {
    service.openLogin();
    service.openCart();
    expect(service.activeOverlay()).toBe('cart');

    service.close();
    expect(service.activeOverlay()).toBeNull();
  });

  it('stores a return URL when opening login and consumes it explicitly', () => {
    service.openLogin('/checkout');

    expect(service.activeOverlay()).toBe('login');
    expect(service.returnUrl()).toBe('/checkout');
    expect(service.consumeReturnUrl()).toBe('/checkout');
    expect(service.returnUrl()).toBeNull();
  });

  it('stores the invalid-session reason when login opens from an invalid session', () => {
    service.openLogin('/checkout', 'invalid-session');

    expect(service.loginReason()).toBe('invalid-session');
    expect(service.returnUrl()).toBe('/checkout');
  });

  it('preserves the authentication context across login and register transitions', () => {
    service.openLogin('/checkout', 'invalid-session');
    service.openRegister();
    expect(service.returnUrl()).toBe('/checkout');
    expect(service.loginReason()).toBe('invalid-session');

    service.openLogin();
    expect(service.activeOverlay()).toBe('login');
    expect(service.returnUrl()).toBe('/checkout');
    expect(service.loginReason()).toBe('invalid-session');
  });

  it('clears stale authentication context on close or a fresh manual login', () => {
    service.openLogin('/checkout', 'invalid-session');
    service.close();
    expect(service.returnUrl()).toBeNull();
    expect(service.loginReason()).toBe('manual');

    service.openLogin('/checkout', 'invalid-session');
    service.openLogin();
    expect(service.returnUrl()).toBeNull();
    expect(service.loginReason()).toBe('manual');
  });
});
