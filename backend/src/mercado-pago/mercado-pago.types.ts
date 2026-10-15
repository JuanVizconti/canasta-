export interface CreateMercadoPagoOrderInput {
  externalReference: string;
  idempotencyKey: string;
  total: string;
  expirationTime: string;
  returnUrl: string;
}

export interface MercadoPagoOrderResult {
  providerOrderId: string;
  checkoutUrl: string;
}

export interface MercadoPagoOrderDetails {
  providerOrderId: string;
  externalReference: string;
  status: string;
  statusDetail: string | null;
}
