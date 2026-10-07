import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthenticatedUser } from '../auth/model/auth.interface';
import { AuthService } from '../auth/service/auth.service';
import { PedidoEstado, PedidoSummary } from '../pedido/model/pedido.interface';
import { PedidoService } from '../pedido/service/pedido.service';

@Component({
  selector: 'app-account',
  imports: [DatePipe],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly pedidoService = inject(PedidoService);
  private readonly router = inject(Router);

  readonly user = signal<AuthenticatedUser | null>(null);
  readonly pedidos = signal<PedidoSummary[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    forkJoin({
      user: this.authService.getCurrentUser(),
      pedidos: this.pedidoService.getPedidos(),
    }).subscribe({
      next: ({ user, pedidos }) => {
        this.user.set(user);
        this.pedidos.set(pedidos);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.status === 0
            ? 'No pudimos cargar tu cuenta. Intentá nuevamente.'
            : 'No pudimos cargar el historial de pedidos. Intentá nuevamente.',
        );
      },
    });
  }

  viewPedido(id: number): void {
    void this.router.navigate(['/pedidos', id]);
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
}
