import { IsNumberString, IsString, MaxLength, MinLength } from 'class-validator';

export class PersonalInfoDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(2)
  apellido: string;

  @IsNumberString()
  @MinLength(7)
  dni: string;

  @IsNumberString()
  @MinLength(8)
  @MaxLength(15)
  telefono: string;
}
