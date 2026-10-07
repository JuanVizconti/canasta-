import { Routes } from '@angular/router';
import { CheckoutComponent } from './checkout/checkout.component';
import { AccountComponent } from './account/account.component';
import { PedidoComponent } from './pedido/pedido.component';
import { ProductListComponent } from './product/product-list.component';

export const routes: Routes = [
  { path: '', component: ProductListComponent},
  { path: 'account', component: AccountComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'pedidos/:id', component: PedidoComponent },
  { path: '**', redirectTo: '' },
];
