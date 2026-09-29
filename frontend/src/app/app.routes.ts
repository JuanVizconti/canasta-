import { Routes } from '@angular/router';
import { CheckoutComponent } from './checkout/checkout.component';
import { PedidoComponent } from './pedido/pedido.component';
import { ProductListComponent } from './product/product-list.component';

export const routes: Routes = [
  { path: '', component: ProductListComponent},
  { path: 'checkout', component: CheckoutComponent },
  { path: 'pedidos/:id', component: PedidoComponent },
  { path: '**', redirectTo: '' },
];
