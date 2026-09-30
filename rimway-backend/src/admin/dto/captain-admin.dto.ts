import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class VehicleDto {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsNumber()
  @IsNotEmpty()
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

export class AdminDocumentInputDto {
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

export class CreateCaptainDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+222[2-4][0-9]{7}$/, { message: 'Phone must be a valid Mauritanian number (e.g., +22230000000)' })
  phone: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle?: VehicleDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminDocumentInputDto)
  documents?: AdminDocumentInputDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminDocumentInputDto)
  vehiclePhotos?: AdminDocumentInputDto[];
}

export class UpdateCaptainDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ActionReasonDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
