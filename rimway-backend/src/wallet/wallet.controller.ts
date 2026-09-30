import { Controller, Get, Post, Body, Req, UseGuards, ForbiddenException, BadRequestException, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { WalletService } from './wallet.service';

@Controller('api/v1/drivers/wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Req() req: any) {
    const driverId = req.user.driverId;
    if (!driverId) throw new ForbiddenException('Driver profile not found');
    return this.walletService.getDriverWallet(driverId);
  }

  @Post('top-up')
  async requestTopUp(
    @Req() req: any,
    @Body('amount') amount: number,
    @Body('reference') reference?: string,
    @Body('notes') notes?: string,
  ) {
    const driverId = req.user.driverId;
    if (!driverId) throw new ForbiddenException('Driver profile not found');
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    return this.walletService.createTopUpRequest(driverId, numAmount, reference, notes);
  }

  @Get('transactions')
  async getTransactions(@Req() req: any, @Query('limit') limit?: string) {
    const driverId = req.user.driverId;
    if (!driverId) throw new ForbiddenException('Driver profile not found');
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.walletService.getCaptainTransactions(driverId, parsedLimit);
  }
}
