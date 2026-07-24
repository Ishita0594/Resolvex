import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { CaseStatus } from './case-status.enum';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ReasonCode } from './reason-code.enum';

class DisputeTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Northstar Electronics' })
  merchantName: string;

  @ApiProperty({ example: '249.99' })
  amount: string;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: '4242' })
  maskedCardLast4: string;
}

class DisputeCaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transactionId: string;

  @ApiProperty({ enum: ReasonCode })
  reasonCode: ReasonCode;

  @ApiProperty({ enum: CaseStatus, example: CaseStatus.AWAITING_MERCHANT })
  status: CaseStatus;

  @ApiProperty()
  cardMemberStatement: string;

  @ApiProperty({ nullable: true })
  merchantStatement: string | null;

  @ApiProperty()
  responseDeadline: string;

  @ApiProperty({ nullable: true })
  resolvedAt: string | null;

  @ApiProperty({ type: DisputeTransactionResponseDto })
  transaction: DisputeTransactionResponseDto;
}

class TimelineEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  caseId: string;

  @ApiProperty({ example: 'CASE_SUBMITTED' })
  eventType: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true })
  performedBy: string | null;

  @ApiProperty({ nullable: true })
  metadata: unknown;

  @ApiProperty()
  createdAt: string;
}

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CARD_MEMBER)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a dispute for one of the card member transactions' })
  @ApiCreatedResponse({ type: DisputeCaseResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid dispute payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only card members can create card-member disputes' })
  @ApiNotFoundResponse({ description: 'Transaction not found for this card member' })
  @ApiConflictResponse({ description: 'An active dispute already exists for this transaction' })
  create(@Body() createDisputeDto: CreateDisputeDto, @CurrentUser() user: PublicUser) {
    return this.disputesService.createForCardMember(user.id, createDisputeDto);
  }

  @Get()
  @ApiOperation({ summary: 'List disputes for the authenticated card member' })
  @ApiOkResponse({ type: DisputeCaseResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only card members can list card-member disputes' })
  list(@CurrentUser() user: PublicUser) {
    return this.disputesService.findForCardMember(user.id);
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Get one dispute for the authenticated card member' })
  @ApiOkResponse({ type: DisputeCaseResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only card members can read card-member disputes' })
  @ApiNotFoundResponse({ description: 'Dispute case not found for this card member' })
  findOne(@Param('caseId', ParseUUIDPipe) caseId: string, @CurrentUser() user: PublicUser) {
    return this.disputesService.findOneForCardMember(caseId, user.id);
  }

  @Get(':caseId/timeline')
  @ApiOperation({ summary: 'Get the timeline for one dispute case' })
  @ApiOkResponse({ type: TimelineEventResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only card members can read card-member timelines' })
  @ApiNotFoundResponse({ description: 'Dispute case not found for this card member' })
  timeline(@Param('caseId', ParseUUIDPipe) caseId: string, @CurrentUser() user: PublicUser) {
    return this.disputesService.findTimelineForCardMember(caseId, user.id);
  }
}
