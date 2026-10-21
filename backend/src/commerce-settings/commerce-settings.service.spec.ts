import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CommerceSettingsService } from './commerce-settings.service';

describe('CommerceSettingsService', () => {
  const settings = {
    id: 1,
    minimumPurchaseAmount: new Prisma.Decimal('10000.00'),
    serviceFee: new Prisma.Decimal('500.00'),
    updatedAt: new Date('2026-10-21T00:00:00.000Z'),
  };

  const createService = (result = settings) => {
    const service = new CommerceSettingsService();
    const prisma = {
      commerceSettings: {
        findUnique: jest.fn().mockResolvedValue(result),
      },
    };
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;
    return { service, prisma };
  };

  beforeEach(() => {
    process.env.DATABASE_URL ??= 'postgresql://canasta:canasta@localhost:5432/canasta?schema=public';
  });

  it('gets the singleton settings row', async () => {
    const { service, prisma } = createService();

    await expect(service.getSettings()).resolves.toEqual(settings);
    expect(prisma.commerceSettings.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('fails clearly when the singleton row is missing', async () => {
    const { service } = createService(null);

    await expect(service.getSettings()).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it.each(['10000.00', '10000.01'])('accepts a subtotal of %s at or above the minimum', async (subtotal) => {
    const { service } = createService();

    await expect(service.validateMinimumPurchase(new Prisma.Decimal(subtotal))).resolves.toEqual(settings);
  });

  it('rejects a subtotal below the minimum', async () => {
    const { service } = createService();

    await expect(service.validateMinimumPurchase(new Prisma.Decimal('9999.99')))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
