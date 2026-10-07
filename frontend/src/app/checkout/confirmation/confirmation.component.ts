import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PedidoQuote } from '../../pedido/model/pedido-quote.interface';
import { CreatePedidoRequest, CreatedPedido } from '../../pedido/model/create-pedido.interface';
import { PedidoService } from '../../pedido/service/pedido.service';
import { CartService } from '../../cart/service/cart.service';
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
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  readonly back = output<void>();
  readonly checkoutData = this.checkoutService.checkoutData;
  readonly quote = signal<PedidoQuote | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly isSubmitting = signal(false);
  readonly creationErrorMessage = signal('');

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

  confirmCashOrder(): void {
    this.confirmOrder('CASH');
  }
  
  confirmMercadoPagoOrder(): void {
    this.confirmOrder('MERCADO_PAGO');
  }
  
  private confirmOrder(paymentMethod: 'CASH' | 'MERCADO_PAGO'): void {
    const request = this.createPedidoRequest(paymentMethod);
    
    if (!request || this.isSubmitting()) {
      return;
    }
    
    this.isSubmitting.set(true);
    this.creationErrorMessage.set('');
    this.pedidoService.create(request).subscribe({
      next: (pedido) => {
        this.handleCreatedPedido(pedido, paymentMethod);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.creationErrorMessage.set(this.getCreationErrorMessage(error));
      },
    });
  }
  
  private createPedidoRequest(
    paymentMethod: 'CASH' | 'MERCADO_PAGO',
  ): CreatePedidoRequest | null {
    const checkoutData = this.checkoutData();
    
    if (
      checkoutData.payment?.method !== paymentMethod ||
      !checkoutData.delivery
    ) {
      return null;
    }
    
    return {
      personalInfo: { ...checkoutData.personalInfo },
      delivery: checkoutData.delivery.method === 'PICKUP'
      ? { method: 'PICKUP' }
      : {
        method: 'DELIVERY',
        address: { ...checkoutData.delivery.address },
      },
      paymentMethod,
    };
  }
  
  private handleCreatedPedido(
    pedido: CreatedPedido,
    paymentMethod: 'CASH' | 'MERCADO_PAGO',
  ): void {
    if (
      paymentMethod === 'MERCADO_PAGO' &&
      pedido.paymentInitialization?.status === 'READY' &&
      pedido.payment.checkoutUrl
    ) {
      this.refreshCart(() => {
        this.isSubmitting.set(false);
        this.redirectToCheckout(pedido.payment.checkoutUrl!);
      });
      return;
    }
    
    if (paymentMethod === 'MERCADO_PAGO') {
      this.refreshCart(() => this.navigateToPedido(pedido.id, { paymentLinkError: true }));
      return;
    }
    
    this.refreshCart(() => this.navigateToPedido(pedido.id));
  }
  
  redirectToCheckout(checkoutUrl: string): void {
    window.location.href = checkoutUrl;
  }
  
  private navigateToPedido(pedidoId: number, state?: { paymentLinkError: boolean }): void {
    void this.router.navigate(['/pedidos', pedidoId], state ? { state } : undefined).finally(() => {
      this.isSubmitting.set(false);
    });
  }
  
  private refreshCart(afterRefresh: () => void): void {
    this.cartService.getCart().subscribe({
      next: afterRefresh,
      error: afterRefresh,
    });
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
  
  private getCreationErrorMessage(error: HttpErrorResponse): string {
    const response = error.error as QuoteErrorResponse | null;
    
    if (response?.code === 'MINIMUM_PURCHASE_NOT_REACHED') {
      return response.message ?? 'El monto mínimo de compra es de $10.000';
    }
    
    if (response?.code === 'INSUFFICIENT_STOCK') {
      return 'Uno o más productos ya no tienen stock suficiente. Revisá tu carrito.';
    }
    
    return 'No pudimos confirmar el pedido. Intentá nuevamente.';
  }
  
  goBack(): void {
    this.back.emit();
  }
}
