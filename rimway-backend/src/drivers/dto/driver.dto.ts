import { IsBoolean, IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class DriverStatusDto {
  @IsBoolean() isOnline: boolean;
}

export class DriverLocationDto {
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
}

