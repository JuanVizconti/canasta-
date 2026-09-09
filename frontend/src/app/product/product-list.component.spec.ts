import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CartService } from '../cart/service/cart.service';
import { Product } from './model/product.interface';
import { ProductListComponent } from './product-list.component';
import { ProductService } from './service/product.service';

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  const products: Product[] = [
    {
      id: 1,
      marca: 'Coca-Cola',
      nombre: 'Coca-Cola 2.25L',
      precio: '2500.50',
      stock: 10,
      imgUrl: null,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        {
          provide: ProductService,
          useValue: {
            getProducts: () => of(products),
          },
        },
        {
          provide: CartService,
          useValue: {
            cart: signal(null).asReadonly(),
            addItem: () => of(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
  });

  it('loads products from ProductService for the template', () => {
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.products()).toEqual(products);
    expect(compiled.textContent).toContain('Coca-Cola 2.25L');
  });
});
