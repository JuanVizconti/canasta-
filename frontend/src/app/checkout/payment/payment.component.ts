import { Component, inject, output, signal } from '@angular/core';
import { PaymentMethod } from '../model/checkout.interface';
import { CheckoutService } from '../service/checkout.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
})
export class PaymentComponent {
  private readonly checkoutService = inject(CheckoutService);
  private readonly storedPayment = this.checkoutService.checkoutData().payment;

  readonly back = output<void>();
  readonly completed = output<void>();
  readonly selectedMethod = signal<PaymentMethod | null>(
    this.storedPayment?.method ?? null,
  );
  readonly hasSubmitted = signal(false);

  selectMethod(method: PaymentMethod): void {
    this.selectedMethod.set(method);
    this.checkoutService.updatePayment({ method });
  }

  continue(): void {
    this.hasSubmitted.set(true);
    const method = this.selectedMethod();

    if (!method) {
      return;
    }

    this.checkoutService.updatePayment({ method });
    this.completed.emit();
  }

  goBack(): void {
    this.back.emit();
  }
}
