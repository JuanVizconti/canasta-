import { Type } from 'class-transformer';
import { IsDefined, IsEnum, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { DeliveryDto } from './delivery.dto';
import { PersonalInfoDto } from './personal-info.dto';

export class CreatePedidoDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery: DeliveryDto;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
