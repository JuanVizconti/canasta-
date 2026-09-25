import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DeliveryAddress,
  DeliveryData,
  DeliveryMethod,
} from '../model/checkout.interface';
import { CheckoutService } from '../service/checkout.service';

const emptyAddress: DeliveryAddress = {
  calle: '',
  numero: '',
  localidad: '',
  codigoPostal: '',
  piso: '',
  departamento: '',
  especificaciones: '',
};

@Component({
  selector: 'app-delivery',
  imports: [FormsModule],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss',
})
export class DeliveryComponent {
  private readonly checkoutService = inject(CheckoutService);
  private readonly storedDelivery = this.checkoutService.checkoutData().delivery;

  readonly back = output<void>();
  readonly completed = output<void>();
  readonly selectedMethod = signal<DeliveryMethod | null>(
    this.storedDelivery?.method ?? null,
  );
  readonly address = signal<DeliveryAddress>(
    this.storedDelivery?.method === 'DELIVERY'
      ? { ...this.storedDelivery.address }
      : { ...emptyAddress },
  );
  readonly hasSubmitted = signal(false);
  readonly pickupAddress = 'Av. Siempre Viva 123, Buenos Aires';
  readonly pickupSchedule = 'Dentro de las próximas 2 horas, de 9 a 18 h.';

  selectMethod(method: DeliveryMethod): void {
    this.selectedMethod.set(method);

    if (method === 'PICKUP') {
      this.checkoutService.updateDelivery({ method: 'PICKUP' });
      return;
    }

    this.persistDeliveryAddress();
  }

  updateAddress(field: keyof DeliveryAddress, value: string): void {
    this.address.update((address) => ({ ...address, [field]: value }));

    if (this.selectedMethod() === 'DELIVERY') {
      this.persistDeliveryAddress();
    }
  }

  continue(): void {
    this.hasSubmitted.set(true);
    const method = this.selectedMethod();

    if (!method) {
      return;
    }

    if (method === 'PICKUP') {
      this.checkoutService.updateDelivery({ method: 'PICKUP' });
      this.completed.emit();
      return;
    }

    if (!this.isAddressValid()) {
      return;
    }

    this.persistDeliveryAddress();
    this.completed.emit();
  }

  goBack(): void {
    this.back.emit();
  }

  isAddressValid(): boolean {
    const { calle, numero, localidad, codigoPostal } = this.address();

    return (
      calle.trim().length > 0 &&
      numero.trim().length > 0 &&
      localidad.trim().length > 0 &&
      codigoPostal.trim().length > 0
    );
  }

  private persistDeliveryAddress(): void {
    const delivery: DeliveryData = {
      method: 'DELIVERY',
      address: { ...this.address() },
    };

    this.checkoutService.updateDelivery(delivery);
  }
}
