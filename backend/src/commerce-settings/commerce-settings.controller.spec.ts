import { Prisma } from '@prisma/client';
import { CommerceSettingsController } from './commerce-settings.controller';
import { CommerceSettingsService } from './commerce-settings.service';

describe('CommerceSettingsController', () => {
  it('returns only the public commercial amounts without authentication', async () => {
    const commerceSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        id: 1,
        minimumPurchaseAmount: new Prisma.Decimal('10000'),
        serviceFee: new Prisma.Decimal('500'),
        updatedAt: new Date(),
      }),
    } as unknown as CommerceSettingsService;
    const controller = new CommerceSettingsController(commerceSettingsService);

    await expect(controller.getSettings()).resolves.toEqual({
      minimumPurchaseAmount: '10000.00',
      serviceFee: '500.00',
    });
  });
});
