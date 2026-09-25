import { IsEnum } from 'class-validator';
import { DeliveryMethod } from '../interfaces/delivery-method.enum';

export class QuotePedidoDto {
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;
}
