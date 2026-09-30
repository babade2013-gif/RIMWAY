import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminAuditService } from './admin-audit.service';

@Controller('api/v1/admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  async getLogs(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.auditService.getLogs(Number(skip) || 0, Number(take) || 20);
  }
}
