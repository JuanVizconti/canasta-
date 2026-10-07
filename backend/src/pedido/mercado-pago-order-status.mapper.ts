export type MercadoPagoOrderAction =
  | 'APPROVED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'NO_ACTION';

export function mapMercadoPagoOrderStatus(
  status: string,
  statusDetail: string | null,
): MercadoPagoOrderAction {
  if (status === 'processed' && statusDetail === 'accredited') {
    return 'APPROVED';
  }

  if (status === 'canceled' && statusDetail === 'canceled') {
    return 'CANCELLED';
  }

  if (
    (status === 'refunded' && statusDetail === 'refunded') ||
    (status === 'processed' && statusDetail === 'refunded')
  ) {
    return 'REFUNDED';
  }

  if (status === 'processed' && statusDetail === 'partially_refunded') {
    return 'PARTIALLY_REFUNDED';
  }

  return 'NO_ACTION';
}
