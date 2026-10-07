import { Component, inject } from '@angular/core';
import { CartReviewComponent } from './cart-review/cart-review.component';
import { ConfirmationComponent } from './confirmation/confirmation.component';
import { DeliveryComponent } from './delivery/delivery.component';
import { PersonalInfoComponent } from './personal-info/personal-info.component';
import { PaymentComponent } from './payment/payment.component';
import { CheckoutService } from './service/checkout.service';

@Component({
  selector: 'app-checkout',
  imports: [
    CartReviewComponent,
    PersonalInfoComponent,
    DeliveryComponent,
    PaymentComponent,
    ConfirmationComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent {
  private readonly checkoutService = inject(CheckoutService);
  readonly checkoutData = this.checkoutService.checkoutData;

  goToCartReview(): void {
    this.checkoutService.updateStep('cart-review');
  }

  goToPersonalInfo(): void {
    this.checkoutService.updateStep('personal-info');
  }

  goToPayment(): void {
    this.checkoutService.updateStep('payment');
  }

  goToDelivery(): void {
    this.checkoutService.updateStep('delivery');
  }

  goToConfirmation(): void {
    this.checkoutService.updateStep('confirmation');
  }
}
