import { Controller, Post, Get, Body, Req, Param, UseGuards, ForbiddenException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { DriverService } from './driver.service';
import { RideService } from '../rides/ride.service';
import { DriverStatusDto, DriverLocationDto } from './dto/driver.dto';
import { DriverRegistrationDto } from './dto/driver-registration.dto';
import { RideStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverController {
  constructor(
    private readonly driverService: DriverService,
    private readonly rideService: RideService,
  ) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user.sub;
    return this.driverService.getDriverMe(userId);
  }

  @Post('register')
  async register(@Body() dto: DriverRegistrationDto, @Req() req: any) {
    const userId = req.user.sub;
    return this.driverService.submitRegistration(userId, dto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          const category = req.query?.category === 'vehicle' ? 'vehicles' : 'documents';
          const uploadPath = path.join(process.cwd(), 'uploads', category);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          const safeName = `${crypto.randomUUID()}${ext}`;
          cb(null, safeName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, PDF`), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No file provided or file rejected');
    const category = req.query?.category === 'vehicle' ? 'vehicles' : 'documents';
    return {
      fileUrl: `/uploads/${category}/${file.filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  @Post('status')
  async setStatus(@Body() dto: DriverStatusDto, @Req() req: any) {
    const userId = req.user.sub;
    return this.driverService.setOnlineStatus(userId, dto.isOnline);
  }

  @Post('location')
  async updateLocation(@Body() dto: DriverLocationDto, @Req() req: any) {
    const userId = req.user.sub;
    return this.driverService.updateLocation(userId, dto.latitude, dto.longitude);
  }

  @Post('rides/:id/accept')
  async acceptRide(@Param('id') rideId: string, @Body('stateVersion') expectedVersion: number, @Req() req: any) {
    const driverId = req.user.driverId;
    if (!driverId) throw new ForbiddenException('Driver profile not found');
    return this.rideService.acceptRide(rideId, driverId, req.user.sub, expectedVersion);
  }

  @Post('rides/:id/arrive')
  async arrivedAtPickup(@Param('id') rideId: string, @Body('stateVersion') expectedVersion: number, @Req() req: any) {
    const userId = req.user.sub;
    return this.rideService.updateRideStatus(rideId, userId, RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED, expectedVersion);
  }

  @Post('rides/:id/boarded')
  async passengerBoarded(@Param('id') rideId: string, @Body('stateVersion') expectedVersion: number, @Req() req: any) {
    const userId = req.user.sub;
    return this.rideService.updateRideStatus(rideId, userId, RideStatus.DRIVER_ARRIVED, RideStatus.PASSENGER_BOARDED, expectedVersion);
  }

  @Post('rides/:id/start')
  async startRide(@Param('id') rideId: string, @Body('stateVersion') expectedVersion: number, @Req() req: any) {
    const userId = req.user.sub;
    return this.rideService.updateRideStatus(rideId, userId, RideStatus.PASSENGER_BOARDED, RideStatus.IN_PROGRESS, expectedVersion);
  }

  @Post('rides/:id/complete')
  async completeRide(@Param('id') rideId: string, @Body('stateVersion') expectedVersion: number, @Req() req: any) {
    const userId = req.user.sub;
    return this.rideService.completeRide(rideId, userId, expectedVersion);
  }

  @Post('rides/:id/cancel')
  async cancelRide(
    @Param('id') rideId: string, 
    @Body('stateVersion') expectedVersion: number, 
    @Body('reason') reason: string,
    @Req() req: any
  ) {
    const userId = req.user.sub;
    return this.rideService.cancelRideByDriver(rideId, userId, expectedVersion, reason);
  }

  @Get('rides/current')
  async getCurrentRide(@Req() req: any) {
    const userId = req.user.sub;
    return this.rideService.getDriverCurrentRide(userId);
  }

  @Get('rides/history')
  async getRideHistory(@Req() req: any) {
    const userId = req.user.sub;
    return this.rideService.getDriverRideHistory(userId);
  }
}
