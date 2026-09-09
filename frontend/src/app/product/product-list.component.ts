import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Product } from './model/product.interface';
import { ProductService } from './service/product.service';
import { CartService } from '../cart/service/cart.service';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  products= signal<Product[]>([]);
  errorMessage = signal('');
  selectedQuantities = signal<Record<number,number>>({});
  notificationMessage = signal('');

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
  ) {}

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

  getSelectedQuantity(productId: number): number {
   return this.selectedQuantities()[productId] ?? 1;
  }

  increaseQuantity(product: Product): void {
  const currentQuantity = this.getSelectedQuantity(product.id);

    if (currentQuantity >= product.stock) {
      return;
    }

    this.selectedQuantities.update((quantities) => ({
      ...quantities,
      [product.id]: currentQuantity + 1,
    }));
  }

  decreaseQuantity(productId: number): void {
  const currentQuantity = this.getSelectedQuantity(productId);

    if (currentQuantity <= 1) {
      return;
    }

    this.selectedQuantities.update((quantities) => ({
      ...quantities,
      [productId]: currentQuantity - 1,
  }));
}

  addToCart(productId: number): void {
    const cantidad = this.getSelectedQuantity(productId);

    this.errorMessage.set('');

    this.cartService.addItem(productId, cantidad).subscribe({
      next: () => {
        this.selectedQuantities.update((quantities) => ({
          ...quantities,
          [productId]: 1,
        }));

        this.notificationMessage.set('Producto agregado al carrito.');

        setTimeout(() => {
          this.notificationMessage.set('');
        }, 2500);
      },
      error: () => {
        this.errorMessage.set('No se pudo agregar el producto al carrito.');

        setTimeout(() => {
          this.errorMessage.set('');
        }, 2500);
      },
    });
  }
}
