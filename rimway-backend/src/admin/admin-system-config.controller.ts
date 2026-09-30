import { Controller, Get, Patch, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { SystemConfigService } from './admin-system-config.service';

@Controller('api/v1/admin/system-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  async getConfig() {
    return this.systemConfigService.getConfig();
  }

  @Patch()
  async updateConfig(
    @Body() body: { minWalletBalance?: number },
    @Req() req: any,
  ) {
    const adminId = req.user.sub;

    if (body.minWalletBalance !== undefined) {
      const amount = Number(body.minWalletBalance);
      if (isNaN(amount)) {
        throw new BadRequestException('minWalletBalance يجب أن يكون رقماً صالحاً');
      }
      return this.systemConfigService.setMinWalletBalance(amount, adminId);
    }

    throw new BadRequestException('لم يتم تحديد أي إعداد للتحديث');
  }
}
