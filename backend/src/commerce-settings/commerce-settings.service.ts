import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { CommerceSettings, Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class CommerceSettingsService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async getSettings(): Promise<CommerceSettings> {
    const settings = await this.prisma.commerceSettings.findUnique({
      where: { id: 1 },
    });

    if (!settings) {
      throw new InternalServerErrorException(
        'Commerce settings are not configured',
      );
    }

    return settings;
  }

  async validateMinimumPurchase(
    subtotal: Prisma.Decimal,
  ): Promise<CommerceSettings> {
    const settings = await this.getSettings();

    if (subtotal.lessThan(settings.minimumPurchaseAmount)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'MINIMUM_PURCHASE_NOT_REACHED',
        message: 'El carrito no alcanza el monto mínimo de compra.',
      });
    }

    return settings;
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
