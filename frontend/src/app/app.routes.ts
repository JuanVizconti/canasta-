import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { CartComponent } from './cart/cart.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { PedidoComponent } from './pedido/pedido.component';
import { ProductListComponent } from './product/product-list.component';

export const routes: Routes = [
  { path: '', component: ProductListComponent},
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'pedidos/:id', component: PedidoComponent },
];
