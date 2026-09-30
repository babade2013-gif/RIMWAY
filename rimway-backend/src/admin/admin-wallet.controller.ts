import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, TopUpStatus } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';

@Controller('api/v1/admin/wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('stats')
  async getStats() {
    return this.walletService.getFinancialSummary();
  }

  @Get('top-ups')
  async getTopUps(@Query('status') status?: TopUpStatus) {
    return this.walletService.getTopUpRequests(status);
  }

  @Post('top-ups/:id/approve')
  async approveTopUp(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.sub;
    return this.walletService.approveTopUp(id, adminId);
  }

  @Post('top-ups/:id/reject')
  async rejectTopUp(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.walletService.rejectTopUp(id, adminId, reason);
  }

  @Post('manual-credit')
  async manualCredit(
    @Body('driverId') driverId: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;
    if (!driverId) throw new BadRequestException('driverId is required');
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Reason is mandatory for manual credit');
    }
    return this.walletService.manualCredit(driverId, adminId, numAmount, reason.trim());
  }

  @Post('manual-debit')
  async manualDebit(
    @Body('driverId') driverId: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;
    if (!driverId) throw new BadRequestException('driverId is required');
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Reason is mandatory for manual debit');
    }
    return this.walletService.manualDebit(driverId, adminId, numAmount, reason.trim());
  }

  @Get('captains/:id')
  async getCaptainWallet(@Param('id') driverId: string) {
    return this.walletService.getDriverWallet(driverId);
  }

  @Get('captains/:id/transactions')
  async getCaptainTransactions(@Param('id') driverId: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.walletService.getCaptainTransactions(driverId, parsedLimit);
  }
}
