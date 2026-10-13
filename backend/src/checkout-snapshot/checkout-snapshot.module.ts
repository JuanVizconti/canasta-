import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MercadoPagoClientModule } from '../mercado-pago/mercado-pago-client.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutPaymentService } from './checkout-payment.service';
import { CheckoutSnapshotService } from './checkout-snapshot.service';

@Module({
  imports: [AuthModule, MercadoPagoClientModule],
  controllers: [CheckoutController],
  providers: [CheckoutSnapshotService, CheckoutPaymentService],
  exports: [CheckoutSnapshotService],
})
export class CheckoutSnapshotModule {}
