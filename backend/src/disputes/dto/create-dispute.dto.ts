import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { ReasonCode } from '../reason-code.enum';

export class CreateDisputeDto {
  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  @IsUUID()
  transactionId: string;

  @ApiProperty({ enum: ReasonCode, example: ReasonCode.GOODS_NOT_RECEIVED })
  @IsEnum(ReasonCode)
  reasonCode: ReasonCode;

  @ApiProperty({
    example: 'The order was expected last week, but the package has not arrived.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  cardMemberStatement: string;
}
