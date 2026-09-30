import { Controller, Get, Put, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminPricingService } from './admin-pricing.service';

@Controller('api/v1/admin/pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPricingController {
  constructor(private readonly pricingService: AdminPricingService) {}

  @Get('service-types')
  async getPricing() {
    return this.pricingService.getPricing();
  }

  @Put('service-types/:id')
  async updatePricing(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const adminId = req.user.sub;
    return this.pricingService.updatePricing(id, dto, adminId);
  }
}
