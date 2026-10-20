import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../enviroments/enviroment';
import { DeliveryData, PersonalInfo } from '../model/checkout.interface';

export interface InitializeMercadoPagoCheckoutRequest {
  personalInfo: PersonalInfo;
  delivery: DeliveryData;
}

export interface InitializeMercadoPagoCheckoutResponse {
  checkoutUrl: string;
}

export type CheckoutSnapshotStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED';

export interface CheckoutSnapshotStatusResponse {
  status: CheckoutSnapshotStatus;
  pedidoId: number | null;
}

@Injectable({ providedIn: 'root' })
export class CheckoutPaymentService {
  private readonly checkoutUrl = `${environment.apiUrl}/checkout/mercado-pago`;

  constructor(private readonly http: HttpClient) {}

  initializeMercadoPago(
    checkout: InitializeMercadoPagoCheckoutRequest,
  ): Observable<InitializeMercadoPagoCheckoutResponse> {
    return this.http.post<InitializeMercadoPagoCheckoutResponse>(
      this.checkoutUrl,
      checkout,
    );
  }

  getSnapshotStatus(
    snapshotId: number,
  ): Observable<CheckoutSnapshotStatusResponse> {
    return this.http.get<CheckoutSnapshotStatusResponse>(
      `${environment.apiUrl}/checkout-snapshots/${snapshotId}/status`,
    );
  }
}
