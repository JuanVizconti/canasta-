import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/service/auth.service';
import { CartService } from './service/cart.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authService.isAuthenticated;
  cart = this.cartService.cart;
  errorMessage = signal('');

  ngOnInit(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    this.loadCart();
  }

  close(): void {
    void this.router.navigateByUrl('/');
  }

  addItem(productId: number, cantidad = 1): void {
    this.updateCart(() => this.cartService.addItem(productId, cantidad));
  }

  updateItem(productId: number, cantidad: number): void {
    this.updateCart(() => this.cartService.updateItem(productId, cantidad));
  }

  removeItem(productId: number): void {
    this.updateCart(() => this.cartService.removeItem(productId));
  }

  increaseQuantity(productId: number, cantidadActual: number, stock: number): void {
  if (cantidadActual >= stock) {
    return;
  }

  this.updateItem(productId, cantidadActual + 1);
}

decreaseQuantity(productId: number, cantidadActual: number): void {
  if (cantidadActual <= 1) {
    return;
  }

  this.updateItem(productId, cantidadActual - 1);
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
