import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/service/auth.service';
import { Cart, CartItem } from '../cart/model/cart.interface';
import { CartService } from '../cart/service/cart.service';
import { Product } from './model/product.interface';
import { ProductService } from './service/product.service';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);

  products = signal<Product[]>([]);
  errorMessage = signal('');
  readonly cartFeedback = this.cartService.feedback;
  private readonly pendingProductIds = signal<ReadonlySet<number>>(new Set());
  readonly cart = this.cartService.cart;
  private readonly loadCartOnAuthentication = effect(() => {
    if (this.authService.isAuthenticated()) {
      this.loadCart();
    }
  });

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los productos.');
      },
    });

  }

  cartItemFor(productId: number): CartItem | undefined {
    if (!this.authService.isAuthenticated()) {
      return undefined;
    }

    return this.cart()?.items.find((item) => item.productId === productId);
  }

  isProductPending(productId: number): boolean {
    return this.pendingProductIds().has(productId);
  }

  addToCart(product: Product): void {
    if (product.stock <= 0 || this.isProductPending(product.id)) {
      return;
    }

    this.performCartOperation(product.id, () => this.cartService.addItem(product.id, 1), 'Producto agregado al carrito.');
  }

  increaseQuantity(product: Product): void {
    const item = this.cartItemFor(product.id);

    if (!item || item.cantidad >= product.stock || this.isProductPending(product.id)) {
      return;
    }

    this.performCartOperation(product.id, () => this.cartService.updateItem(product.id, item.cantidad + 1));
  }

  decreaseQuantity(product: Product): void {
    const item = this.cartItemFor(product.id);

    if (!item || this.isProductPending(product.id)) {
      return;
    }

    if (item.cantidad === 1) {
      this.performCartOperation(product.id, () => this.cartService.removeItem(product.id));
      return;
    }

    this.performCartOperation(product.id, () => this.cartService.updateItem(product.id, item.cantidad - 1));
  }

  private loadCart(): void {
    this.cartService.getCart().subscribe({
      error: () => this.cartService.showError('No se pudo cargar el carrito.'),
    });
  }

  private performCartOperation(
    productId: number,
    request: () => Observable<Cart>,
    successMessage = 'Carrito actualizado.',
  ): void {
    this.cartService.clearFeedback();
    this.pendingProductIds.update((pending) => new Set(pending).add(productId));

    request().subscribe({
      next: () => {
        this.cartService.showSuccess(successMessage);
        this.completeProductOperation(productId);
      },
      error: () => {
        this.cartService.showError('No se pudo actualizar el carrito.');
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
