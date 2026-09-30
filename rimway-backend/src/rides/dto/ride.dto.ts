import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class EstimateFareDto {
  @IsNumber() pickupLat: number;
  @IsNumber() pickupLng: number;
  @IsNumber() dropoffLat: number;
  @IsNumber() dropoffLng: number;
  @IsString() @IsNotEmpty() serviceTypeId: string;
}

export class RequestRideDto extends EstimateFareDto {
  @IsString() @IsNotEmpty() pickupName: string;
  @IsString() @IsNotEmpty() dropoffName: string;
}

export class CancelRideDto {
  @IsString() @IsNotEmpty() rideId: string;
}
