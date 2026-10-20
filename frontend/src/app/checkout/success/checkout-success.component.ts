import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CheckoutPaymentService,
  CheckoutSnapshotStatusResponse,
} from '../service/checkout-payment.service';
import { CartService } from '../../cart/service/cart.service';
import { CheckoutService } from '../service/checkout.service';

@Component({
  selector: 'app-checkout-success',
  templateUrl: './checkout-success.component.html',
  styleUrl: './checkout-success.component.scss',
})
export class CheckoutSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checkoutPaymentService = inject(CheckoutPaymentService);
  private readonly cartService = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);
  private snapshotId: number | null = null;
  private hasRefreshedCompletedCart = false;

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
        this.refreshCompletedCheckout(status);
      },
      error: () => {
        this.hasRequestError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private refreshCompletedCheckout(status: CheckoutSnapshotStatusResponse): void {
    if (status.status !== 'COMPLETED' || this.hasRefreshedCompletedCart) {
      return;
    }

    this.hasRefreshedCompletedCart = true;
    this.checkoutService.clearCheckout();
    this.cartService.getCart().subscribe({ error: () => undefined });
  }
}
