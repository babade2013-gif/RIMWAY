import { Controller, Get, Post, Patch, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminCaptainsService } from './admin-captains.service';
import { CreateCaptainDto, UpdateCaptainDto, VehicleDto, ActionReasonDto } from './dto/captain-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/admin/captains')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCaptainsController {
  constructor(private readonly adminCaptainsService: AdminCaptainsService) {}

  @Get()
  async getCaptains(@Query() query: any) {
    return this.adminCaptainsService.getCaptains(query);
  }

  @Post()
  async createCaptain(@Body() dto: CreateCaptainDto, @Req() req: any) {
    return this.adminCaptainsService.createCaptain(req.user.sub, dto);
  }

  @Get(':id')
  async getCaptainDetails(@Param('id') id: string) {
    return this.adminCaptainsService.getCaptainDetails(id);
  }

  @Patch(':id')
  async updateCaptain(@Param('id') id: string, @Body() dto: UpdateCaptainDto, @Req() req: any) {
    return this.adminCaptainsService.updateCaptain(id, req.user.sub, dto);
  }

  @Post(':id/approve')
  async approveCaptain(@Param('id') id: string, @Body() dto: ActionReasonDto, @Req() req: any) {
    return this.adminCaptainsService.approveCaptain(id, req.user.sub, dto);
  }

  @Post(':id/reject')
  async rejectCaptain(@Param('id') id: string, @Body() dto: ActionReasonDto, @Req() req: any) {
    return this.adminCaptainsService.rejectCaptain(id, req.user.sub, dto);
  }

  @Post(':id/suspend')
  async suspendCaptain(@Param('id') id: string, @Body() dto: ActionReasonDto, @Req() req: any) {
    return this.adminCaptainsService.suspendCaptain(id, req.user.sub, dto);
  }

  @Post(':id/reactivate')
  async reactivateCaptain(@Param('id') id: string, @Body() dto: ActionReasonDto, @Req() req: any) {
    return this.adminCaptainsService.reactivateCaptain(id, req.user.sub, dto);
  }

  @Post(':id/priority')
  async updatePriorityTier(
    @Param('id') id: string,
    @Body() dto: { priorityTier: string; reason?: string },
    @Req() req: any,
  ) {
    return this.adminCaptainsService.updatePriorityTier(id, req.user.sub, dto.priorityTier, dto.reason);
  }

  @Put(':id/vehicle')
  async updateVehicle(@Param('id') id: string, @Body() dto: VehicleDto, @Req() req: any) {
    return this.adminCaptainsService.updateVehicle(id, req.user.sub, dto);
  }

  @Get(':id/wallet')
  async getWallet(@Param('id') id: string) {
    return this.adminCaptainsService.getWallet(id);
  }

  @Get(':id/wallet/transactions')
  async getWalletTransactions(@Param('id') id: string, @Query() query: any) {
    return this.adminCaptainsService.getWalletTransactions(id, query);
  }

  @Get(':id/complaints')
  async getComplaints(@Param('id') id: string, @Query() query: any) {
    return this.adminCaptainsService.getComplaints(id, query);
  }
}
