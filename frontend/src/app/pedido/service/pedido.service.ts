import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DeliveryMethod } from '../../checkout/model/checkout.interface';
import { PedidoQuote } from '../model/pedido-quote.interface';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly pedidosUrl = 'http://localhost:3000/pedidos';

  constructor(private readonly http: HttpClient) {}

  quote(deliveryMethod: DeliveryMethod): Observable<PedidoQuote> {
    return this.http.post<PedidoQuote>(`${this.pedidosUrl}/quote`, { deliveryMethod });
  }
}
