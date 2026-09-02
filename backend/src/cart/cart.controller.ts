import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  findForUser(@Req() request: AuthenticatedRequest) {
    return this.cartService.findForUser(request.user.id);
  }

  @Post('items')
  addItem(
    @Req() request: AuthenticatedRequest,
    @Body() addCartItemDto: AddCartItemDto,
  ) {
    return this.cartService.addItem(request.user.id, addCartItemDto);
  }

  @Patch('items/:productId')
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(
      request.user.id,
      productId,
      updateCartItemDto,
    );
  }

  @Delete('items/:productId')
  removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.cartService.removeItem(request.user.id, productId);
  }
}
