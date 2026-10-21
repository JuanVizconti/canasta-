import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../enviroments/enviroment';
import { Cart } from '../model/cart.interface';

export const CART_MESSAGE_TIMEOUT_MS = 4000;

export interface CartFeedback {
  type: 'success' | 'error';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly apiUrl = environment.apiUrl;
  private readonly cartUrl = `${this.apiUrl}/cart`;

  private readonly _cart = signal<Cart | null>(null);
  private readonly _feedback = signal<CartFeedback | null>(null);
  private feedbackTimeout: ReturnType<typeof setTimeout> | undefined;
  readonly cart = this._cart.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  constructor(private readonly http: HttpClient) {}

  getCart(): Observable<Cart> {
    return this.http.get<Cart>(this.cartUrl).pipe(
      tap((cart)=> this._cart.set(cart))
    );
  }

  addItem(productId: number, cantidad: number): Observable<Cart> {
    return this.http.post<Cart>(`${this.cartUrl}/items`, { productId, cantidad })
    .pipe(
        tap((cart) => this._cart.set(cart)),
    );
  }

  updateItem(productId: number, cantidad: number): Observable<Cart> {
    return this.http.patch<Cart>(`${this.cartUrl}/items/${productId}`, { cantidad })
    .pipe(
        tap((cart) => this._cart.set(cart)),
    );
  }

  removeItem(productId: number): Observable<Cart> {
    return this.http.delete<Cart>(`${this.cartUrl}/items/${productId}`)
    .pipe(
        tap((cart) => this._cart.set(cart)),
    );
  }

  showSuccess(text: string): void {
    this.showFeedback({ type: 'success', text });
  }

  showError(text: string): void {
    this.showFeedback({ type: 'error', text });
  }

  clearFeedback(): void {
    if (this.feedbackTimeout !== undefined) {
      clearTimeout(this.feedbackTimeout);
      this.feedbackTimeout = undefined;
    }

    this._feedback.set(null);
  }

  private showFeedback(feedback: CartFeedback): void {
    this.clearFeedback();
    this._feedback.set(feedback);
    this.feedbackTimeout = setTimeout(() => {
      this._feedback.set(null);
      this.feedbackTimeout = undefined;
    }, CART_MESSAGE_TIMEOUT_MS);
  }
}
