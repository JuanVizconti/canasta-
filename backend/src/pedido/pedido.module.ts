import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { PedidoController } from './pedido.controller';
import { PedidoService } from './pedido.service';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [PedidoController],
  providers: [PedidoService],
})
export class PedidoModule {}
