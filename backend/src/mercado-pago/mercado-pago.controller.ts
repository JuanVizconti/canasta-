import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CheckoutSnapshotProcessService } from '../checkout-snapshot/checkout-snapshot-process.service';
import { mapMercadoPagoOrderStatus } from '../pedido/mercado-pago-order-status.mapper';
import { MercadoPagoService } from './mercado-pago.service';

@Controller('mercado-pago')
export class MercadoPagoController {
  constructor(
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly checkoutSnapshotProcessService: CheckoutSnapshotProcessService,
  ) {}

  @Post('webhook')
  async webhook(
    @Body() body: unknown,
    @Query() query: Record<string, string>,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    const isSignatureValid = this.mercadoPagoService.validateWebhookSignature(
      body,
      query,
      signature,
      requestId,
    );

    if (!isSignatureValid) {
      console.log('Mercado Pago webhook signature invalid');
      throw new UnauthorizedException('Unauthorized');
    }

    console.log('Mercado Pago webhook received');
    console.log('Mercado Pago webhook signature valid');

    const orderId = this.mercadoPagoService.getWebhookDataId(body, query);
    if (!orderId) {
      throw new BadRequestException('Webhook data.id is required');
    }

    const order = await this.mercadoPagoService.getOrderById(orderId);
    const action = mapMercadoPagoOrderStatus(order.status, order.statusDetail);

    if (action === 'APPROVED') {
      await this.checkoutSnapshotProcessService.processApprovedOrder(order);
    }

    if (action === 'CANCELLED') {
      await this.checkoutSnapshotProcessService.processCancelledOrder(order);
    }

    if (action === 'REFUNDED') {
      await this.checkoutSnapshotProcessService.processRefundedOrder(order);
    }

    console.log('Mercado Pago order fetched');
    console.log({
      providerOrderId: order.providerOrderId,
      externalReference: order.externalReference,
      status: order.status,
      statusDetail: order.statusDetail,
    });

    return { received: true };
  }
}
