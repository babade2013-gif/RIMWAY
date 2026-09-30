import { Controller, Get, Post, Body, Param, Req, UseGuards, Headers } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreatePhoneRideDto, AdminCancelRideDto } from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('rides')
  async getRides() {
    return this.adminService.getRides();
  }

  @Get('rides/:id')
  async getRideDetails(@Param('id') id: string) {
    return this.adminService.getRideDetails(id);
  }

  @Post('rides')
  async createPhoneRide(@Body() dto: CreatePhoneRideDto, @Req() req: any, @Headers('Idempotency-Key') idempotencyKey?: string) {
    const adminId = req.user.sub;
    return this.adminService.createPhoneRide(adminId, dto, idempotencyKey);
  }

  @Post('rides/:id/cancel')
  async cancelRide(@Param('id') id: string, @Body() dto: AdminCancelRideDto, @Req() req: any) {
    const adminId = req.user.sub;
    return this.adminService.cancelRide(id, adminId, dto);
  }
}
