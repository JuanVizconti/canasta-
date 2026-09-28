import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Pedido, PedidoEstado, PedidoPaymentMethod, PedidoPaymentStatus } from './model/pedido.interface';
import { PedidoService } from './service/pedido.service';

interface PedidoErrorResponse {
  code?: string;
}

@Component({
  selector: 'app-pedido',
  imports: [DatePipe],
  templateUrl: './pedido.component.html',
  styleUrl: './pedido.component.scss',
})
export class PedidoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pedidoService = inject(PedidoService);
  private pedidoId: number | null = null;

  readonly pedido = signal<Pedido | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id');
    const pedidoId = Number(routeId);

    if (!routeId || !Number.isInteger(pedidoId) || pedidoId <= 0) {
      this.isLoading.set(false);
      this.errorMessage.set('El identificador del pedido no es válido.');
      return;
    }

    this.pedidoId = pedidoId;
    this.loadPedido();
  }

  retry(): void {
    if (this.pedidoId !== null) {
      this.loadPedido();
    }
  }

  pedidoStatusLabel(estado: PedidoEstado): string {
    return {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmado',
      IN_PROGRESS: 'En preparación',
      FINISHED: 'Finalizado',
      CANCELLED: 'Cancelado',
    }[estado];
  }

  paymentMethodLabel(method: PedidoPaymentMethod): string {
    return method === 'CASH' ? 'Efectivo' : 'Mercado Pago';
  }

  paymentStatusLabel(status: PedidoPaymentStatus): string {
    return {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  private loadPedido(): void {
    const pedidoId = this.pedidoId;

    if (pedidoId === null) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.pedido.set(null);
    this.pedidoService.getById(pedidoId).subscribe({
      next: (pedido) => {
        this.pedido.set(pedido);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.getErrorMessage(error));
      },
    });
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    const response = error.error as PedidoErrorResponse | null;

    return response?.code === 'PEDIDO_NOT_FOUND'
      ? 'No encontramos este pedido.'
      : 'No pudimos cargar el pedido. Intentá nuevamente.';
  }
}
