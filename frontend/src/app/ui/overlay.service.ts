import { Injectable, signal } from '@angular/core';

export type OverlayType = 'login' | 'register' | 'cart' | null;
export type LoginReason = 'manual' | 'invalid-session';

@Injectable({ providedIn: 'root' })
export class OverlayService {
  private readonly _activeOverlay = signal<OverlayType>(null);
  private readonly _returnUrl = signal<string | null>(null);
  private readonly _loginReason = signal<LoginReason>('manual');

  readonly activeOverlay = this._activeOverlay.asReadonly();
  readonly returnUrl = this._returnUrl.asReadonly();
  readonly loginReason = this._loginReason.asReadonly();

  openLogin(returnUrl?: string | null, reason?: LoginReason): void {
    const previousOverlay = this._activeOverlay();
    const preservesAuthFlow =
      previousOverlay === 'register' && returnUrl === undefined && reason === undefined;

    this._activeOverlay.set('login');
    this._returnUrl.set(
      returnUrl ?? (preservesAuthFlow ? this._returnUrl() : null),
    );
    this._loginReason.set(
      reason ?? (preservesAuthFlow ? this._loginReason() : 'manual'),
    );
  }

  openRegister(): void {
    this._activeOverlay.set('register');
  }

  openCart(): void {
    this._activeOverlay.set('cart');
  }

  close(): void {
    this._activeOverlay.set(null);
    this._returnUrl.set(null);
    this._loginReason.set('manual');
  }

  consumeReturnUrl(): string | null {
    const returnUrl = this._returnUrl();
    this._returnUrl.set(null);
    return returnUrl;
  }
}
