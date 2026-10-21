import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CommerceSettingsModule } from '../commerce-settings/commerce-settings.module';
import { PedidoController } from './pedido.controller';
import { PedidoService } from './pedido.service';

@Module({
  imports: [AuthModule, CartModule, CommerceSettingsModule],
  controllers: [PedidoController],
  providers: [PedidoService],
  exports: [PedidoService],
})
export class PedidoModule {}
