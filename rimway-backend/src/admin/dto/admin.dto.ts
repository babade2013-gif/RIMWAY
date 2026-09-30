import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { RequestRideDto } from '../../rides/dto/ride.dto';

export class CreatePhoneRideDto extends RequestRideDto {
  @IsString() @IsNotEmpty() customerName: string;
  @IsString() @IsNotEmpty() customerPhone: string;
  @IsNumber() @IsOptional() estimatedFare?: number;
  @IsNumber() @IsOptional() distanceKm?: number;
}

export class AdminCancelRideDto {
  @IsNumber() @IsNotEmpty() stateVersion: number;
  @IsString() @IsOptional() reason?: string;
}
