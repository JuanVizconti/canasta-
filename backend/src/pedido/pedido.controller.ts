import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { QuotePedidoDto } from './dto/quote-pedido.dto';
import { PedidoService } from './pedido.service';

@Controller('pedidos')
@UseGuards(JwtAuthGuard)
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post('quote')
  quote(
    @Req() request: AuthenticatedRequest,
    @Body() quotePedidoDto: QuotePedidoDto,
  ) {
    return this.pedidoService.quote(request.user.id, quotePedidoDto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.pedidoService.findAllByUser(request.user.id);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) pedidoId: number,
  ) {
    return this.pedidoService.findOneForUser(request.user.id, pedidoId);
  }

  @Post(':id/payment/retry')
  retryMercadoPagoPayment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) pedidoId: number,
  ) {
    return this.pedidoService.retryMercadoPagoPayment(request.user.id, pedidoId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createPedidoDto: CreatePedidoDto,
  ) {
    return this.pedidoService.create(request.user.id, createPedidoDto);
  }
}
