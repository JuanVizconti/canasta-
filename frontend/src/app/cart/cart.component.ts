import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/service/auth.service';
import { CommerceSettingsService } from '../commerce-settings/service/commerce-settings.service';
import { OverlayService } from '../ui/overlay.service';
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
  private readonly overlayService = inject(OverlayService);
  private readonly commerceSettingsService = inject(CommerceSettingsService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  cart = this.cartService.cart;
  readonly commerceSettings = this.commerceSettingsService.settings;
  readonly isLoadingCommerceSettings = this.commerceSettingsService.isLoading;
  readonly commerceSettingsError = this.commerceSettingsService.errorMessage;
  errorMessage = signal('');

  ngOnInit(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    this.loadCart();
    this.loadCommerceSettings();
  }

  close(): void {
    this.overlayService.close();
  }

  continueToCheckout(): void {
    if (!this.canContinueToCheckout()) {
      return;
    }

    this.overlayService.close();
    void this.router.navigate(['/checkout']);
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

  canContinueToCheckout(): boolean {
    const cart = this.cart();
    const settings = this.commerceSettings();

    return !!cart && cart.items.length > 0 && !!settings && !this.isBelowMinimum();
  }

  isBelowMinimum(): boolean {
    const cart = this.cart();
    const settings = this.commerceSettings();

    return !!cart && !!settings && Number(cart.price) < Number(settings.minimumPurchaseAmount);
  }

  remainingForMinimum(): string {
    const cart = this.cart();
    const settings = this.commerceSettings();

    if (!cart || !settings) {
      return '0.00';
    }

    return Math.max(0, Number(settings.minimumPurchaseAmount) - Number(cart.price)).toFixed(2);
  }

  totalWithServiceFee(): string {
    const cart = this.cart();
    const settings = this.commerceSettings();

    if (!cart || !settings) {
      return '0.00';
    }

    return (Number(cart.price) + Number(settings.serviceFee)).toFixed(2);
  }

  loadCommerceSettings(): void {
    this.commerceSettingsService.load();
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

    setTimeout(() => {
          this.errorMessage.set('');
    }, 2500 );
  }
}
