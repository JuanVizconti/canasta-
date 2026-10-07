import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeliveryAddressDto {
  @IsString()
  @MinLength(1)
  calle: string;

  @IsString()
  @MinLength(1)
  numero: string;

  @IsString()
  @MinLength(1)
  localidad: string;

  @IsString()
  @MinLength(1)
  codigoPostal: string;

  @IsOptional()
  @IsString()
  piso?: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsString()
  especificaciones?: string;
}
