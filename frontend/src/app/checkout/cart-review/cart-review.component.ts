import { Component, inject, OnInit, output, signal } from '@angular/core';
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

  ngOnInit(): void {
    if (this.cart() === null) {
      this.loadCart();
    }
  }

  increaseQuantity(productId: number, cantidadActual: number, stock: number): void {
    if (cantidadActual < stock) {
      this.updateCart(() => this.cartService.updateItem(productId, cantidadActual + 1));
    }
  }

  decreaseQuantity(productId: number, cantidadActual: number): void {
    if (cantidadActual > 1) {
      this.updateCart(() => this.cartService.updateItem(productId, cantidadActual - 1));
    }
  }

  removeItem(productId: number): void {
    this.updateCart(() => this.cartService.removeItem(productId));
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

  private updateCart(request: () => ReturnType<CartService['getCart']>): void {
    this.errorMessage.set('');
    request().subscribe({
      error: () => this.errorMessage.set('No se pudo actualizar el carrito.'),
    });
  }
}
