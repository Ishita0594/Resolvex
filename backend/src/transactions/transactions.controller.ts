import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import { TransactionsService } from './transactions.service';

class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantId: string;

  @ApiProperty({ example: 'Northstar Electronics' })
  merchantName: string;

  @ApiProperty({ example: '249.99', description: 'Decimal amount serialized as a string.' })
  amount: string;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty()
  transactionDate: string;

  @ApiProperty({ example: 'POSTED' })
  status: string;

  @ApiProperty({ example: '4242' })
  maskedCardLast4: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CARD_MEMBER)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List transactions for the authenticated card member' })
  @ApiOkResponse({ type: TransactionResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only card members can read card-member transactions' })
  list(@CurrentUser() user: PublicUser) {
    return this.transactionsService.findForCardMember(user.id);
  }

  @Get(':transactionId')
  @ApiOperation({ summary: 'Get one transaction for the authenticated card member' })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only card members can read card-member transactions' })
  @ApiNotFoundResponse({ description: 'Transaction not found for this card member' })
  findOne(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.transactionsService.findOneForCardMember(transactionId, user.id);
  }
}
