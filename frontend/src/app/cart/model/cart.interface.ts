import { Product } from '../../product/model/product.interface';

export interface Cart {
  id: number | null;
  price: string;
  items: CartItem[];
}

export interface CartItem {
  id: number;
  productId: number;
  cantidad: number;
  product: Product;
}
