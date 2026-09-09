import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Cart } from '../model/cart.interface';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly cartUrl = 'http://localhost:3000/cart';

  private readonly _cart = signal<Cart | null>(null);
  readonly cart = this._cart.asReadonly();

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
}
