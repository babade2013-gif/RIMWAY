import { Module, forwardRef } from '@nestjs/common';
import { RideController } from './ride.controller';
import { RideService } from './ride.service';
import { RideTimeoutService } from './ride-timeout.service';
import { RideStateMachine } from './ride-state.machine';
import { PricingService } from '../pricing/pricing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RideGateway } from '../events/ride.gateway';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DriversModule } from '../drivers/drivers.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, JwtModule, forwardRef(() => AuthModule), forwardRef(() => DriversModule), WalletModule],
  controllers: [RideController],
  providers: [RideService, RideTimeoutService, RideStateMachine, PricingService, RideGateway],
  exports: [RideService]
})
export class RidesModule {}

