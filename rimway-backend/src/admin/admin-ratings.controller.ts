import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminRatingsService } from './admin-ratings.service';

@Controller('api/v1/admin/ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminRatingsController {
  constructor(private readonly ratingsService: AdminRatingsService) {}

  @Get('drivers/:driverId')
  async getDriverRatings(@Param('driverId') driverId: string) {
    return this.ratingsService.getDriverRatings(driverId);
  }

  @Get()
  async getAllRatings(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.ratingsService.getAllRatings(Number(skip) || 0, Number(take) || 20);
  }
}
