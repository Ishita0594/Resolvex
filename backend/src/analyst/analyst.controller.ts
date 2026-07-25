import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import { AnalystReviewService } from './analyst-review.service';
import { AnalystDecisionDto } from './dto/analyst-decision.dto';
import { RequestInformationDto } from './dto/request-information.dto';

@ApiTags('Analyst')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST)
@Controller('analyst/cases')
export class AnalystController {
  constructor(private readonly analystReviewService: AnalystReviewService) {}

  @Get()
  @ApiOperation({ summary: 'List cases requiring analyst review' })
  @ApiOkResponse({ description: 'Analyst case queue' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only analysts can access analyst cases',
  })
  list() {
    return this.analystReviewService.listQueue();
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Get one analyst-review case' })
  @ApiOkResponse({ description: 'Analyst case details' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only analysts can access analyst cases',
  })
  @ApiNotFoundResponse({ description: 'Dispute case not found' })
  findOne(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.analystReviewService.findOne(caseId);
  }

  @Post(':caseId/decision')
  @ApiOperation({ summary: 'Record an analyst decision for a case' })
  @ApiOkResponse({ description: 'Analyst decision result' })
  @ApiBadRequestResponse({
    description: 'Override reason required or invalid payload',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only analysts can decide cases' })
  @ApiNotFoundResponse({ description: 'Dispute case not found' })
  @ApiConflictResponse({
    description: 'Invalid status transition or closed case',
  })
  decide(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: AnalystDecisionDto,
    @CurrentUser() user: PublicUser,
    @Req() request: Request,
  ) {
    return this.analystReviewService.decide(caseId, user, dto, request.ip);
  }

  @Post(':caseId/request-information')
  @ApiOperation({ summary: 'Request additional information for a case' })
  @ApiOkResponse({ description: 'Information request result' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only analysts can request information',
  })
  @ApiNotFoundResponse({ description: 'Dispute case not found' })
  @ApiConflictResponse({
    description: 'Invalid status transition or closed case',
  })
  requestInformation(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: RequestInformationDto,
    @CurrentUser() user: PublicUser,
    @Req() request: Request,
  ) {
    return this.analystReviewService.requestInformation(
      caseId,
      user,
      dto,
      request.ip,
    );
  }
}
