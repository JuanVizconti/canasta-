import { IsInt, IsPositive } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @IsPositive()
  cantidad: number;
}
