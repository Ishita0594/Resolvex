import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../users/user-role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'ResolveX Member' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'member@resolvex.demo' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'dev-password-only' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CARD_MEMBER })
  @IsEnum(UserRole)
  role: UserRole;
}
