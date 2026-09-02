import { IsInt, IsPositive } from 'class-validator';

export class AddCartItemDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  cantidad: number;
}
