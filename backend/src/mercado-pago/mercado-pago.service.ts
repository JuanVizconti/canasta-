import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  CreateMercadoPagoOrderInput,
  MercadoPagoOrderDetails,
  MercadoPagoOrderResult,
} from './mercado-pago.types';

const MERCADO_PAGO_ORDERS_URL = 'https://api.mercadopago.com/v1/orders';
const MERCADO_PAGO_REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class MercadoPagoService {
  validateWebhookSignature(
    body: unknown,
    query: Record<string, string>,
    signature: string | undefined,
    requestId: string | undefined,
  ): boolean {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error('MERCADO_PAGO_WEBHOOK_SECRET is required');
    }

    const dataId = this.getWebhookDataId(body, query);
    const signatureParts = this.parseSignature(signature);

    if (!dataId || !requestId || !signatureParts) {
      return false;
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${signatureParts.ts};`;
    const computedHash = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    const computedHashBuffer = Buffer.from(computedHash, 'hex');
    const receivedHashBuffer = Buffer.from(signatureParts.v1, 'hex');

    return (
      computedHashBuffer.length === receivedHashBuffer.length &&
      timingSafeEqual(computedHashBuffer, receivedHashBuffer)
    );
  }

  async createOrder(
    input: CreateMercadoPagoOrderInput,
  ): Promise<MercadoPagoOrderResult> {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN is required');
    }

    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is required');
    }

    const normalizedFrontendUrl = frontendUrl.replace(/\/+$/, '');
    if (!normalizedFrontendUrl) {
      throw new Error('FRONTEND_URL is required');
    }

    const returnUrl = `${normalizedFrontendUrl}/pedidos/${input.pedidoId}`;

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
        config: {
          online: {
            success_url: returnUrl,
            failure_url: returnUrl,
            pending_url: returnUrl,
            auto_return: 'all',
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Mercado Pago order creation failed with status ${response.status}`,
      );
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

  async getOrderById(orderId: string): Promise<MercadoPagoOrderDetails> {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN is required');
    }

    const response = await fetch(
      `${MERCADO_PAGO_ORDERS_URL}/${encodeURIComponent(orderId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(MERCADO_PAGO_REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Mercado Pago order fetch failed with status ${response.status}`,
      );
    }

    const data: unknown = await response.json();
    if (!this.isOrderDetailsResponse(data)) {
      throw new Error(
        'Mercado Pago order details response is missing required fields',
      );
    }

    return {
      providerOrderId: data.id,
      externalReference: data.external_reference,
      status: data.status,
      statusDetail: data.status_detail ?? null,
    };
  }

  getWebhookDataId(
    body: unknown,
    query: Record<string, string>,
  ): string | undefined {
    const queryDataId = query['data.id'];

    if (typeof queryDataId === 'string' && queryDataId.trim()) {
      return queryDataId.trim();
    }

    if (typeof body !== 'object' || body === null) {
      return undefined;
    }

    const data = (body as Record<string, unknown>)['data'];
    if (typeof data !== 'object' || data === null) {
      return undefined;
    }

    const dataId = (data as Record<string, unknown>)['id'];
    return typeof dataId === 'string' || typeof dataId === 'number'
      ? String(dataId)
      : undefined;
  }

  private isOrderResponse(
    value: unknown,
  ): value is { id: string; checkout_url: string } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const response = value as Record<string, unknown>;
    return (
      typeof response['id'] === 'string' &&
      typeof response['checkout_url'] === 'string'
    );
  }

  private isOrderDetailsResponse(value: unknown): value is {
    id: string;
    external_reference: string;
    status: string;
    status_detail?: string | null;
  } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const response = value as Record<string, unknown>;
    const statusDetail = response['status_detail'];

    return (
      typeof response['id'] === 'string' &&
      typeof response['external_reference'] === 'string' &&
      typeof response['status'] === 'string' &&
      (statusDetail === undefined ||
        statusDetail === null ||
        typeof statusDetail === 'string')
    );
  }

  private parseSignature(
    signature: string | undefined,
  ): { ts: string; v1: string } | undefined {
    if (!signature) {
      return undefined;
    }

    const parts = new Map<string, string>();
    for (const part of signature.split(',')) {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key && value) {
        parts.set(key, value);
      }
    }

    const ts = parts.get('ts');
    const v1 = parts.get('v1');

    return ts && v1 ? { ts, v1 } : undefined;
  }
}
