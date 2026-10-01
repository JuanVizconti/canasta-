export interface CreateMercadoPagoOrderInput {
  pedidoId: number;
  idempotencyKey: string;
  total: string;
  expirationTime: string;
  payerEmail: string;
}

export interface MercadoPagoOrderResult {
  providerOrderId: string;
  checkoutUrl: string;
}