import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutSnapshotStatusController } from './checkout-snapshot-status.controller';
import { CheckoutSnapshotService } from './checkout-snapshot.service';

describe('CheckoutSnapshotStatusController', () => {
  it('is protected by JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CheckoutSnapshotStatusController),
    ).toContain(JwtAuthGuard);
  });

  it('uses the authenticated user id to load the snapshot status', async () => {
    const checkoutSnapshotService = {
      findStatusForUser: jest.fn().mockResolvedValue({
        status: 'COMPLETED',
        pedidoId: 84,
      }),
    } as unknown as CheckoutSnapshotService;
    const controller = new CheckoutSnapshotStatusController(
      checkoutSnapshotService,
    );

    await expect(controller.findStatus({ user: { id: 7 } } as never, 20)).resolves.toEqual({
      status: 'COMPLETED',
      pedidoId: 84,
    });
    expect(checkoutSnapshotService.findStatusForUser).toHaveBeenCalledWith(7, 20);
  });
});
