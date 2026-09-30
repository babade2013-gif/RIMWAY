import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminDocumentsService } from './admin-documents.service';

@Controller('api/v1/admin/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminDocumentsController {
  constructor(private readonly documentsService: AdminDocumentsService) {}

  @Get('drivers/:driverId')
  async getDocuments(@Param('driverId') driverId: string) {
    return this.documentsService.getDocuments(driverId);
  }

  @Post()
  async createDocumentMetadata(@Body() dto: any) {
    return this.documentsService.createDocumentMetadata(dto);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: { status: string, verifiedBy: string }) {
    return this.documentsService.updateStatus(id, dto.status, dto.verifiedBy);
  }
}
