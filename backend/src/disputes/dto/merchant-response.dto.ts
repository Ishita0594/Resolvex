import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MerchantResponseEvidenceDto {
  @ApiProperty({ example: 'delivery_confirmation' })
  @IsString()
  @MinLength(1)
  requirementKey: string;

  @ApiProperty({ example: 'tracking_record' })
  @IsString()
  @MinLength(1)
  evidenceType: string;

  @ApiPropertyOptional({
    example: 'Carrier tracking shows delivery on 2026-07-02.',
  })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: '40000000-0000-4000-8000-000000000001' })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional({
    example: {
      trackingNumber: 'DEMO-TRACK-123',
      carrier: 'Prototype Carrier',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class MerchantResponseDto {
  @ApiProperty({
    example: 'We shipped the goods to the card member address and have attached shipment and delivery proof.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  merchantStatement: string;

  @ApiProperty({ type: MerchantResponseEvidenceDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MerchantResponseEvidenceDto)
  evidence: MerchantResponseEvidenceDto[];
}
