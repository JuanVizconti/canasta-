import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { MercadoPagoModule } from './mercado-pago/mercado-pago.module';
import { PedidoModule } from './pedido/pedido.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';

@Module({
  imports: [AuthModule, CartModule, PedidoModule, MercadoPagoModule],
  controllers: [ProductController, UserController],
  providers: [ProductService, UserService],
})
export class AppModule {}
