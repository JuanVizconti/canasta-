import { Injectable } from '@nestjs/common';
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import {
  CheckoutSnapshotService,
  CreateCheckoutSnapshotInput,
} from './checkout-snapshot.service';

@Injectable()
export class CheckoutPaymentService {
  constructor(
    private readonly checkoutSnapshotService: CheckoutSnapshotService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  async initializeMercadoPago(userId: number,checkout: CreateCheckoutSnapshotInput,): Promise<{ checkoutUrl: string }> {
    const snapshot = await this.checkoutSnapshotService.create(userId, checkout);

    let order: Awaited<ReturnType<MercadoPagoService['createOrder']>>;

    try {
      if (!snapshot.idempotencyKey) {
        throw new Error('Checkout snapshot was created without an idempotency key');
      }

      order = await this.mercadoPagoService.createOrder({
        externalReference: String(snapshot.id),
        idempotencyKey: snapshot.idempotencyKey,
        total: snapshot.total.toFixed(2),
        expirationTime: this.toExpirationTime(snapshot.expiresAt),
        returnUrls: this.getReturnUrls(snapshot.id),
      });
    } catch (error) {
      await this.checkoutSnapshotService.markFailedAndRestoreStock(snapshot.id);
      throw error;
    }

    // The remote order exists if this update fails. Do not release stock or mark failed.
    await this.checkoutSnapshotService.saveMercadoPagoOrder(
      snapshot.id,
      order.providerOrderId,
      order.checkoutUrl,
    );

    return { checkoutUrl: order.checkoutUrl };
  }

  private getReturnUrls(snapshotId: number): {
    success: string;
    pending: string;
    failure: string;
  } {
    const frontendUrl = process.env.FRONTEND_URL;
    const normalizedFrontendUrl = frontendUrl?.replace(/\/+$/, '');

    if (!normalizedFrontendUrl) {
      throw new Error('FRONTEND_URL is required');
    }

    const paymentStatusUrl = `${normalizedFrontendUrl}/checkout/success?snapshotId=${snapshotId}`;

    return {
      success: paymentStatusUrl,
      pending: paymentStatusUrl,
      failure: `${normalizedFrontendUrl}/checkout/confirmation`,
    };
  }

  private toExpirationTime(expiresAt: Date): string {
    const remainingSeconds = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    );
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return seconds === 0 ? `PT${minutes}M` : `PT${minutes}M${seconds}S`;
  }
}
