import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, output, signal } from '@angular/core';
import { PedidoQuote } from '../../pedido/model/pedido-quote.interface';
import { PedidoService } from '../../pedido/service/pedido.service';
import { CheckoutService } from '../service/checkout.service';

interface QuoteErrorResponse {
  code?: string;
  message?: string;
}

@Component({
  selector: 'app-confirmation',
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss',
})
export class ConfirmationComponent implements OnInit {
  private readonly checkoutService = inject(CheckoutService);
  private readonly pedidoService = inject(PedidoService);

  readonly back = output<void>();
  readonly checkoutData = this.checkoutService.checkoutData;
  readonly quote = signal<PedidoQuote | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadQuote();
  }

  loadQuote(): void {
    const delivery = this.checkoutData().delivery;

    if (!delivery) {
      this.quote.set(null);
      this.errorMessage.set('No encontramos un método de entrega para cotizar el pedido.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.quote.set(null);
    this.pedidoService.quote(delivery.method).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.getQuoteErrorMessage(error));
      },
    });
  }

  goBack(): void {
    this.back.emit();
  }

  paymentLabel(): string {
    const paymentMethod = this.checkoutData().payment?.method;

    if (paymentMethod === 'CASH') {
      return 'Efectivo';
    }

    if (paymentMethod === 'MERCADO_PAGO') {
      return 'Mercado Pago';
    }

    return 'No seleccionado';
  }

  private getQuoteErrorMessage(error: HttpErrorResponse): string {
    const response = error.error as QuoteErrorResponse | null;

    if (response?.code === 'MINIMUM_PURCHASE_NOT_REACHED') {
      return response.message ?? 'El monto mínimo de compra es de $10.000';
    }

    return 'No pudimos calcular el total del pedido. Intentá nuevamente.';
  }
}
