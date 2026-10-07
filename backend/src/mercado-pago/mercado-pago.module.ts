import { Module } from '@nestjs/common';
import { PedidoModule } from '../pedido/pedido.module';
import { MercadoPagoClientModule } from './mercado-pago-client.module';
import { MercadoPagoController } from './mercado-pago.controller';

@Module({
  imports: [MercadoPagoClientModule, PedidoModule],
  controllers: [MercadoPagoController],
})
export class MercadoPagoModule {}
