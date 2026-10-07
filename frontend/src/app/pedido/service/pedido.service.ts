import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../enviroments/enviroment';
import { DeliveryMethod } from '../../checkout/model/checkout.interface';
import { CreatedPedido, CreatePedidoRequest } from '../model/create-pedido.interface';
import { PedidoQuote } from '../model/pedido-quote.interface';
import { Pedido, PedidoSummary, RetryPaymentResponse } from '../model/pedido.interface';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly apiUrl = environment.apiUrl;
  private readonly pedidosUrl = `${this.apiUrl}/pedidos`;

  constructor(private readonly http: HttpClient) {}

  quote(deliveryMethod: DeliveryMethod): Observable<PedidoQuote> {
    return this.http.post<PedidoQuote>(`${this.pedidosUrl}/quote`, { deliveryMethod });
  }

  create(pedido: CreatePedidoRequest): Observable<CreatedPedido> {
    return this.http.post<CreatedPedido>(this.pedidosUrl, pedido);
  }

  getById(id: number): Observable<Pedido> {
    return this.http.get<Pedido>(`${this.pedidosUrl}/${id}`);
  }

  getPedidos(): Observable<PedidoSummary[]> {
    return this.http.get<PedidoSummary[]>(this.pedidosUrl);
  }

  retryPayment(id: number): Observable<RetryPaymentResponse> {
    return this.http.post<RetryPaymentResponse>(
      `${this.pedidosUrl}/${id}/payment/retry`,
      {},
    );
  }
}
