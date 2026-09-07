import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Product } from './model/product.interface';
import { ProductService } from './service/product.service';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  products= signal<Product[]>([]);
  errorMessage = signal('');

  constructor(private readonly productService: ProductService) {}

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
}
