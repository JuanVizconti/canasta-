import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CheckoutPaymentService,
  CheckoutSnapshotStatusResponse,
} from '../service/checkout-payment.service';

@Component({
  selector: 'app-checkout-success',
  templateUrl: './checkout-success.component.html',
  styleUrl: './checkout-success.component.scss',
})
export class CheckoutSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checkoutPaymentService = inject(CheckoutPaymentService);
  private snapshotId: number | null = null;

  readonly status = signal<CheckoutSnapshotStatusResponse | null>(null);
  readonly isLoading = signal(false);
  readonly hasRequestError = signal(false);
  readonly hasInvalidSnapshotId = signal(false);

  ngOnInit(): void {
    const snapshotId = this.route.snapshot.queryParamMap.get('snapshotId');
    const parsedSnapshotId = Number(snapshotId);

    if (
      !snapshotId ||
      !Number.isInteger(parsedSnapshotId) ||
      parsedSnapshotId <= 0
    ) {
      this.hasInvalidSnapshotId.set(true);
      return;
    }

    this.snapshotId = parsedSnapshotId;
    this.loadStatus();
  }

  refreshStatus(): void {
    this.loadStatus();
  }

  followPedido(): void {
    const status = this.status();
    const pedidoId = status?.pedidoId;

    if (status?.status === 'COMPLETED' && pedidoId !== null && pedidoId !== undefined) {
      void this.router.navigate(['/pedidos', pedidoId]);
    }
  }

  private loadStatus(): void {
    if (this.snapshotId === null || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.hasRequestError.set(false);
    this.status.set(null);
    this.checkoutPaymentService.getSnapshotStatus(this.snapshotId).subscribe({
      next: (status) => {
        this.status.set(status);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasRequestError.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
