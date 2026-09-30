import { Controller, Post, Get, Body, Req, Headers, UseGuards, Param } from '@nestjs/common';
import { RideService } from './ride.service';
import { EstimateFareDto, RequestRideDto, CancelRideDto } from './dto/ride.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/rides')
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Get('services')
  async getServices() {
    return this.rideService.getServiceTypes();
  }

  @Post('estimate')
  async estimateFare(@Body() dto: EstimateFareDto) {
    // Estimate is kept public based on typical ride-hailing design, 
    // but can be guarded if needed.
    return this.rideService.estimateFare(dto);
  }

  @Post('request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PASSENGER)
  async requestRide(@Body() dto: RequestRideDto, @Req() req: any, @Headers('Idempotency-Key') idempotencyKey: string) {
    const passengerId = req.user.sub;
    return this.rideService.requestRide(passengerId, dto, idempotencyKey);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PASSENGER)
  async cancelRide(@Body() dto: CancelRideDto, @Req() req: any) {
    const passengerId = req.user.sub;
    return this.rideService.cancelRide(dto.rideId, passengerId);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PASSENGER)
  async getCurrentRide(@Req() req: any) {
    const passengerId = req.user.sub;
    return this.rideService.getCurrentRide(passengerId);
  }

  @Post(':id/rate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PASSENGER)
  async rateRide(@Param('id') rideId: string, @Body() dto: { rating: number, comment?: string }, @Req() req: any) {
    const passengerId = req.user.sub;
    return this.rideService.rateRide(rideId, passengerId, dto.rating, dto.comment);
  }
}
