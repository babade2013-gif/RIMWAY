import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrationVehicleDto {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsInt()
  @Min(1990)
  @Max(2035)
  year: number;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @IsString()
  @IsNotEmpty()
  serviceTypeId: string;
}

export class RegistrationFileDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}

export class DriverRegistrationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @ValidateNested()
  @Type(() => RegistrationVehicleDto)
  @IsNotEmpty()
  vehicle: RegistrationVehicleDto;

  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => RegistrationFileDto)
  documents: RegistrationFileDto[];

  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => RegistrationFileDto)
  vehiclePhotos: RegistrationFileDto[];
}
