import { Component, inject, OnInit, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Cart } from '../../cart/model/cart.interface';
import { CartService } from '../../cart/service/cart.service';
import { CheckoutService } from '../service/checkout.service';

@Component({
  selector: 'app-cart-review',
  templateUrl: './cart-review.component.html',
  styleUrl: './cart-review.component.scss',
})
export class CartReviewComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);

  readonly completed = output<void>();
  readonly cart = this.cartService.cart;
  readonly errorMessage = signal('');
  private readonly pendingProductIds = signal<ReadonlySet<number>>(new Set());

  ngOnInit(): void {
    if (this.cart() === null) {
      this.loadCart();
    }
  }

  increaseQuantity(productId: number, cantidadActual: number, stock: number): void {
    if (cantidadActual < stock && !this.isProductPending(productId)) {
      this.updateCart(productId, () => this.cartService.updateItem(productId, cantidadActual + 1));
    }
  }

  decreaseQuantity(productId: number, cantidadActual: number): void {
    if (this.isProductPending(productId)) {
      return;
    }

    if (cantidadActual === 1) {
      this.removeItem(productId);
      return;
    }

    this.updateCart(productId, () => this.cartService.updateItem(productId, cantidadActual - 1));
  }

  removeItem(productId: number): void {
    if (!this.isProductPending(productId)) {
      this.updateCart(productId, () => this.cartService.removeItem(productId));
    }
  }

  isProductPending(productId: number): boolean {
    return this.pendingProductIds().has(productId);
  }

  confirmCart(): void {
    const cart = this.cart();

    if (!cart || cart.items.length === 0) {
      return;
    }

    this.checkoutService.updateCart(cart);
    this.completed.emit();
  }

  private loadCart(): void {
    this.cartService.getCart().subscribe({
      error: () => this.errorMessage.set('No se pudo cargar el carrito.'),
    });
  }

  private updateCart(productId: number, request: () => Observable<Cart>): void {
    this.errorMessage.set('');
    this.pendingProductIds.update((pending) => new Set(pending).add(productId));
    request().subscribe({
      next: (cart) => {
        this.checkoutService.updateCart(cart);
        this.completeProductOperation(productId);
      },
      error: () => {
        this.errorMessage.set('No se pudo actualizar el carrito.');
        this.completeProductOperation(productId);
      },
    });
  }

  private completeProductOperation(productId: number): void {
    this.pendingProductIds.update((pending) => {
      const nextPending = new Set(pending);
      nextPending.delete(productId);
      return nextPending;
    });
  }
}
