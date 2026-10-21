import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CommerceSettingsModule } from './commerce-settings/commerce-settings.module';
import { CheckoutSnapshotModule } from './checkout-snapshot/checkout-snapshot.module';
import { MercadoPagoModule } from './mercado-pago/mercado-pago.module';
import { PedidoModule } from './pedido/pedido.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    CartModule,
    CommerceSettingsModule,
    CheckoutSnapshotModule,
    PedidoModule,
    MercadoPagoModule,
  ],
  controllers: [ProductController, UserController],
  providers: [ProductService, UserService],
})
export class AppModule {}
