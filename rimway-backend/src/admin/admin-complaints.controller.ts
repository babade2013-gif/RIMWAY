import { Controller, Get, Put, Param, Body, UseGuards, Query, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminComplaintsService } from './admin-complaints.service';

@Controller('api/v1/admin/complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminComplaintsController {
  constructor(private readonly complaintsService: AdminComplaintsService) {}

  @Get()
  async getComplaints(@Query('status') status?: string) {
    return this.complaintsService.getComplaints(status);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    const adminId = req.user.sub;
    return this.complaintsService.updateStatus(id, status, adminId);
  }
}
