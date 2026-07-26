import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty()
  @IsUUID()
  evidenceId: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7c75a5a5efcff8e',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  fileHash?: string;
}
