import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { MercadoPagoClientModule } from '../mercado-pago/mercado-pago-client.module';
import { PedidoController } from './pedido.controller';
import { MercadoPagoOrderProcessService } from './mercado-pago-order-process.service';
import { PedidoService } from './pedido.service';

@Module({
  imports: [AuthModule, CartModule, MercadoPagoClientModule],
  controllers: [PedidoController],
  providers: [PedidoService, MercadoPagoOrderProcessService],
  exports: [PedidoService],
})
export class PedidoModule {}
