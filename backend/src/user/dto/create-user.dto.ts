import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(5)
  usuario: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
