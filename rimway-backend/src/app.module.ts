import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';
import { DriversModule } from './drivers/drivers.module';
import { AdminModule } from './admin/admin.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, UsersModule, PrismaModule, RidesModule, DriversModule, AdminModule, WalletModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
