import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'member@resolvex.demo' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'dev-password-only' })
  @IsString()
  @MinLength(8)
  password: string;
}
