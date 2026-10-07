import { inject, Injectable, signal } from '@angular/core';
import { Cart } from '../../cart/model/cart.interface';
import {
  CheckoutData,
  CheckoutStep,
  DeliveryData,
  PaymentData,
  PersonalInfo,
} from '../model/checkout.interface';
import { CheckoutStorageService } from './checkout-storage.service';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly storage = inject(CheckoutStorageService);
  private readonly checkout = signal<CheckoutData>(this.storage.load());

  readonly checkoutData = this.checkout.asReadonly();

  updatePersonalInfo(personalInfo: PersonalInfo): void {
    this.checkout.update((current) => ({
      ...current,
      personalInfo: { ...personalInfo },
    }));
    this.persistCheckoutData();
  }

  updateDelivery(delivery: DeliveryData): void {
    this.checkout.update((current) => ({ ...current, delivery }));
    this.persistCheckoutData();
  }

  updateCart(cart: Cart): void {
    this.checkout.update((current) => ({
      ...current,
      cart: this.cloneCart(cart),
    }));
    this.persistCheckoutData();
  }

  updateStep(currentStep: CheckoutStep): void {
    this.checkout.update((current) => ({ ...current, currentStep }));
    this.persistCheckoutData();
  }

  updatePayment(payment: PaymentData): void {
    this.checkout.update((current) => ({ ...current, payment }));
    this.persistCheckoutData();
  }

  clearCheckout(): void {
    this.storage.clear();
    this.checkout.set(this.storage.load());
  }

  private persistCheckoutData(): void {
    this.storage.save(this.checkout());
  }

  private cloneCart(cart: Cart): Cart {
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        product: { ...item.product },
      })),
    };
  }
}
