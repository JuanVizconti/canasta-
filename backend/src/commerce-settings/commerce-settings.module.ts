import { Module } from '@nestjs/common';
import { CommerceSettingsController } from './commerce-settings.controller';
import { CommerceSettingsService } from './commerce-settings.service';

@Module({
  controllers: [CommerceSettingsController],
  providers: [CommerceSettingsService],
  exports: [CommerceSettingsService],
})
export class CommerceSettingsModule {}
