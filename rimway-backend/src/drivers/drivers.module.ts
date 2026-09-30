import { Module, forwardRef } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RidesModule } from '../rides/rides.module';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigService } from '../admin/admin-system-config.service';

@Module({
  imports: [PrismaModule, forwardRef(() => RidesModule), forwardRef(() => AuthModule)],
  controllers: [DriverController],
  providers: [DriverService, SystemConfigService],
  exports: [DriverService]
})
export class DriversModule {}
