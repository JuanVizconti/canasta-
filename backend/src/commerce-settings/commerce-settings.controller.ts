import { Controller, Get } from '@nestjs/common';
import { CommerceSettingsService } from './commerce-settings.service';

@Controller('commerce-settings')
export class CommerceSettingsController {
  constructor(private readonly commerceSettingsService: CommerceSettingsService) {}

  @Get()
  async getSettings() {
    const settings = await this.commerceSettingsService.getSettings();

    return {
      minimumPurchaseAmount: settings.minimumPurchaseAmount.toFixed(2),
      serviceFee: settings.serviceFee.toFixed(2),
    };
  }
}
