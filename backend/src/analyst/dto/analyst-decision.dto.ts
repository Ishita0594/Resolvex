import { AnalystDecision } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class AnalystDecisionDto {
  @IsEnum(AnalystDecision)
  decision: AnalystDecision;

  @ValidateIf((dto: AnalystDecisionDto) => dto.overrideReason !== undefined)
  @IsString()
  @MaxLength(2000)
  overrideReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  analystNotes?: string;
}
