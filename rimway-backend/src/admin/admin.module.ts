import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCaptainsController } from './admin-captains.controller';
import { AdminCaptainsService } from './admin-captains.service';
import { AdminDocumentsController } from './admin-documents.controller';
import { AdminDocumentsService } from './admin-documents.service';
import { AdminRatingsController } from './admin-ratings.controller';
import { AdminRatingsService } from './admin-ratings.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminComplaintsController } from './admin-complaints.controller';
import { AdminComplaintsService } from './admin-complaints.service';
import { AdminPricingController } from './admin-pricing.controller';
import { AdminPricingService } from './admin-pricing.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminWalletController } from './admin-wallet.controller';
import { AdminSystemConfigController } from './admin-system-config.controller';
import { SystemConfigService } from './admin-system-config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RidesModule } from '../rides/rides.module';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, RidesModule, AuthModule, WalletModule],
  controllers: [
    AdminController, 
    AdminCaptainsController,
    AdminDocumentsController,
    AdminRatingsController,
    AdminDashboardController,
    AdminComplaintsController,
    AdminPricingController,
    AdminAuditController,
    AdminWalletController,
    AdminSystemConfigController,
  ],
  providers: [
    AdminService, 
    AdminCaptainsService,
    AdminDocumentsService,
    AdminRatingsService,
    AdminDashboardService,
    AdminComplaintsService,
    AdminPricingService,
    AdminAuditService,
    SystemConfigService,
  ],
  exports: [SystemConfigService],
})
export class AdminModule {}
