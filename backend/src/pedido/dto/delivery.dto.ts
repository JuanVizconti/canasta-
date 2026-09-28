import { Type } from 'class-transformer';
import { IsDefined, IsEnum, ValidateIf, ValidateNested } from 'class-validator';
import { DeliveryMethod } from '../interfaces/delivery-method.enum';
import { DeliveryAddressDto } from './delivery-address.dto';

export class DeliveryDto {
  @IsEnum(DeliveryMethod)
  method: DeliveryMethod;

  @ValidateIf((delivery: DeliveryDto) => delivery.method === DeliveryMethod.DELIVERY)
  @IsDefined()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  address?: DeliveryAddressDto;
}
