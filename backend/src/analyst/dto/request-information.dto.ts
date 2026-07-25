import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestInformationDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedEvidenceTypes?: string[];
}
