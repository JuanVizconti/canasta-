import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MercadoPagoClientModule } from '../mercado-pago/mercado-pago-client.module';
import { PedidoModule } from '../pedido/pedido.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutPaymentService } from './checkout-payment.service';
import { CheckoutSnapshotProcessService } from './checkout-snapshot-process.service';
import { CheckoutSnapshotReconciliationService } from './checkout-snapshot-reconciliation.service';
import { CheckoutSnapshotStatusController } from './checkout-snapshot-status.controller';
import { CheckoutSnapshotService } from './checkout-snapshot.service';

@Module({
  imports: [AuthModule, MercadoPagoClientModule, PedidoModule],
  controllers: [CheckoutController, CheckoutSnapshotStatusController],
  providers: [
    CheckoutSnapshotService,
    CheckoutSnapshotReconciliationService,
    CheckoutSnapshotProcessService,
    CheckoutPaymentService,
  ],
  exports: [CheckoutSnapshotService, CheckoutSnapshotProcessService],
})
export class CheckoutSnapshotModule {}
