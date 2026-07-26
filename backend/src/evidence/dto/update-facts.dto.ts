import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EvidenceFactDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'tracking_number' })
  @IsString()
  @Length(1, 80)
  factType: string;

  @ApiProperty({ example: 'DEMO-TRACK-123' })
  @IsString()
  @Length(1, 2000)
  factValue: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  normalizedValue?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 0.92 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number | null;

  @ApiProperty({ required: false, nullable: true, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sourcePage?: number | null;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  verifiedByUser?: boolean;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  correctedByUser?: boolean;
}

export class UpdateFactsDto {
  @ApiProperty({ type: EvidenceFactDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceFactDto)
  facts: EvidenceFactDto[];
}
