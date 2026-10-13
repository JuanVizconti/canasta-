import { Module } from '@nestjs/common';
import { CheckoutSnapshotModule } from '../checkout-snapshot/checkout-snapshot.module';
import { MercadoPagoClientModule } from './mercado-pago-client.module';
import { MercadoPagoController } from './mercado-pago.controller';

@Module({
  imports: [MercadoPagoClientModule, CheckoutSnapshotModule],
  controllers: [MercadoPagoController],
})
export class MercadoPagoModule {}
