import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutPaymentService } from './checkout-payment.service';
import type { CreateCheckoutSnapshotInput } from './checkout-snapshot.service';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutPaymentService: CheckoutPaymentService) {}

  @Post('mercado-pago')
  initializeMercadoPago(
    @Req() request: AuthenticatedRequest,
    @Body() checkout: CreateCheckoutSnapshotInput,
  ) {
    return this.checkoutPaymentService.initializeMercadoPago(
      request.user.id,
      checkout,
    );
  }
}
