import { Injectable } from '@nestjs/common';
import { CreateMercadoPagoOrderInput, MercadoPagoOrderResult } from './mercado-pago.types';

const MERCADO_PAGO_ORDERS_URL = 'https://api.mercadopago.com/v1/orders';
const MERCADO_PAGO_REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class MercadoPagoService {
  
  async createOrder(
    input: CreateMercadoPagoOrderInput,): Promise<MercadoPagoOrderResult> 
    {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN is required');
    }

    const response = await fetch(MERCADO_PAGO_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      signal: AbortSignal.timeout(MERCADO_PAGO_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'manual',
        external_reference: String(input.pedidoId),
        total_amount: input.total,
        expiration_time: input.expirationTime,
        payer: { email: input.payerEmail },        
      }),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago order creation failed with status ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!this.isOrderResponse(data)) {
      throw new Error('Mercado Pago order response is missing id or checkout_url');
    }

    return {
      providerOrderId: data.id,
      checkoutUrl: data.checkout_url,
    };
  }

  private isOrderResponse(
    value: unknown,
  ): value is { id: string; checkout_url: string } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const response = value as Record<string, unknown>;
    return typeof response['id'] === 'string' && typeof response['checkout_url'] === 'string';
  }
}
