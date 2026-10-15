import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutSnapshotService } from './checkout-snapshot.service';

@Controller('checkout-snapshots')
@UseGuards(JwtAuthGuard)
export class CheckoutSnapshotStatusController {
  constructor(private readonly checkoutSnapshotService: CheckoutSnapshotService) {}

  @Get(':id/status')
  findStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) snapshotId: number,
  ) {
    return this.checkoutSnapshotService.findStatusForUser(
      request.user.id,
      snapshotId,
    );
  }
}
