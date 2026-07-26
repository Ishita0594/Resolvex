import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
import { MerchantCasesService } from './merchant-cases.service';
import { ReasonCode } from './reason-code.enum';

class MerchantDisputeCaseResponseDto {
  id: string;
  transactionId: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  status: CaseStatus;
  cardMemberStatement: string;
  merchantStatement: string | null;
  merchantResponseDate: string | null;
  merchantResponseStatus: string;
  responseDeadline: string;
  resolvedAt: string | null;
}

@ApiTags('Merchant Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
@Controller('merchant/disputes')
export class MerchantCasesController {
  constructor(private readonly merchantCasesService: MerchantCasesService) {}

  @Get()
  @ApiOperation({
    summary: 'List disputes assigned to the authenticated merchant',
  })
  @ApiOkResponse({ type: MerchantDisputeCaseResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only merchants can list merchant disputes',
  })
  list(@CurrentUser() user: PublicUser) {
    return this.merchantCasesService.findForMerchant(user.id);
  }

  @Get(':caseId')
  @ApiOperation({
    summary: 'Get one dispute assigned to the authenticated merchant',
  })
  @ApiOkResponse({ type: MerchantDisputeCaseResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only merchants can read merchant disputes',
  })
  @ApiNotFoundResponse({
    description: 'Dispute case not found for this merchant',
  })
  findOne(@Param('caseId', ParseUUIDPipe) caseId: string, @CurrentUser() user: PublicUser) {
    return this.merchantCasesService.findOneForMerchant(caseId, user.id);
  }
}
