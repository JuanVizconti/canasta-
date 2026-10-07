import { mapMercadoPagoOrderStatus } from './mercado-pago-order-status.mapper';

describe('mapMercadoPagoOrderStatus', () => {
  it('maps processed and accredited to APPROVED', () => {
    expect(mapMercadoPagoOrderStatus('processed', 'accredited')).toBe('APPROVED');
  });

  it('maps canceled and canceled to CANCELLED', () => {
    expect(mapMercadoPagoOrderStatus('canceled', 'canceled')).toBe('CANCELLED');
  });

  it.each([
    ['refunded', 'refunded'],
    ['processed', 'refunded'],
  ])('maps %s / %s to REFUNDED', (status, statusDetail) => {
    expect(mapMercadoPagoOrderStatus(status, statusDetail)).toBe('REFUNDED');
  });

  it('maps processed and partially_refunded to PARTIALLY_REFUNDED', () => {
    expect(mapMercadoPagoOrderStatus('processed', 'partially_refunded'))
      .toBe('PARTIALLY_REFUNDED');
  });

  it.each([
    ['created', 'created'],
    ['processing', 'in_process'],
    ['processing', 'pending_review_manual'],
    ['action_required', 'waiting_capture'],
    ['failed', 'processing_error'],
    ['processed', 'unknown'],
    ['unknown', 'unknown'],
    ['processed', null],
  ])('maps %s / %s to NO_ACTION', (status, statusDetail) => {
    expect(mapMercadoPagoOrderStatus(status, statusDetail)).toBe('NO_ACTION');
  });
});
