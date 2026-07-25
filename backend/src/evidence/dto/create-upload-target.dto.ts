import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateUploadTargetDto {
  @ApiProperty({ example: 'delivery_confirmation' })
  @IsString()
  @Length(1, 80)
  evidenceType: string;

  @ApiProperty({ example: 'delivery-proof.pdf' })
  @IsString()
  @Length(1, 255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @Length(1, 120)
  mimeType: string;

  @ApiProperty({ example: 204800 })
  @IsInt()
  @Min(1)
  sizeBytes: number;
}
