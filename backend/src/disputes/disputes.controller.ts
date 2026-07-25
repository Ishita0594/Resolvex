import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
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
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PublicUser } from "../users/public-user.type";
import { UserRole } from "../users/user-role.enum";
import { CaseStatus } from "./case-status.enum";
import { DisputesService } from "./disputes.service";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { MerchantResponseDto } from "./dto/merchant-response.dto";
import { MerchantCasesService } from "./merchant-cases.service";
import { PolicyEvaluationService } from "./policy-evaluation.service";
import {
  PolicyRequirementResponse,
  PolicyRequirementsService,
} from "./policy-requirements.service";
import { ReasonCode } from "./reason-code.enum";

class DisputeTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: "Northstar Electronics" })
  merchantName: string;

  @ApiProperty({ example: "249.99" })
  amount: string;

  @ApiProperty({ example: "USD" })
  currency: string;

  @ApiProperty({ example: "4242" })
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

  @ApiProperty({ nullable: true })
  merchantResponseDate: string | null;

  @ApiProperty({ example: "PENDING" })
  merchantResponseStatus: string;

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

  @ApiProperty({ example: "CASE_SUBMITTED" })
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

class PolicyRequirementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ReasonCode })
  reasonCode: ReasonCode;

  @ApiProperty({ example: "delivery_confirmation" })
  requirementKey: string;

  @ApiProperty({ example: "Delivery confirmation" })
  requirementName: string;

  @ApiProperty({
    example:
      "Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides carrier delivery confirmation or tracking proof.",
  })
  description: string;

  @ApiProperty({
    example: ["delivery_confirmation", "tracking_record", "carrier_proof"],
  })
  acceptedEvidenceTypes: string[];

  @ApiProperty({ example: 25 })
  weight: number;

  @ApiProperty({ example: true })
  isMandatory: boolean;

  @ApiProperty({ example: "prototype-v1" })
  policyVersion: string;

  @ApiProperty({ example: true })
  active: boolean;
}

@ApiTags("Disputes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("disputes")
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly merchantCasesService: MerchantCasesService,
    private readonly policyRequirementsService: PolicyRequirementsService,
    private readonly policyEvaluationService: PolicyEvaluationService,
  ) {}

  @Post()
  @Roles(UserRole.CARD_MEMBER)
  @ApiOperation({
    summary: "Create a dispute for one of the card member transactions",
  })
  @ApiCreatedResponse({ type: DisputeCaseResponseDto })
  @ApiBadRequestResponse({ description: "Invalid dispute payload" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only card members can create card-member disputes",
  })
  @ApiNotFoundResponse({
    description: "Transaction not found for this card member",
  })
  @ApiConflictResponse({
    description: "An active dispute already exists for this transaction",
  })
  create(
    @Body() createDisputeDto: CreateDisputeDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.disputesService.createForCardMember(user.id, createDisputeDto);
  }

  @Get()
  @Roles(UserRole.CARD_MEMBER)
  @ApiOperation({ summary: "List disputes for the authenticated card member" })
  @ApiOkResponse({ type: DisputeCaseResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only card members can list card-member disputes",
  })
  list(@CurrentUser() user: PublicUser) {
    return this.disputesService.findForCardMember(user.id);
  }

  @Get(":caseId/requirements")
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary:
      "Get prototype policy requirements for a merchant dispute response",
  })
  @ApiOkResponse({ type: PolicyRequirementResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only merchants can read merchant response requirements",
  })
  @ApiNotFoundResponse({
    description: "Dispute case not found for this merchant",
  })
  requirements(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<PolicyRequirementResponse[]> {
    return this.policyRequirementsService.findForMerchantCase(caseId, user.id);
  }

  @Post(":caseId/merchant-response")
  @HttpCode(200)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: "Submit a structured merchant response for an assigned dispute",
  })
  @ApiOkResponse({ type: DisputeCaseResponseDto })
  @ApiBadRequestResponse({
    description: "Invalid merchant response payload or evidence checklist",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only merchants can submit merchant responses",
  })
  @ApiNotFoundResponse({
    description: "Dispute case not found for this merchant",
  })
  @ApiConflictResponse({
    description: "Duplicate, expired, or invalid status transition",
  })
  submitMerchantResponse(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() merchantResponseDto: MerchantResponseDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.merchantCasesService.submitMerchantResponse(
      caseId,
      user.id,
      merchantResponseDto,
    );
  }

  @Post(":caseId/evaluate")
  @HttpCode(200)
  @Roles(UserRole.ANALYST)
  @ApiOperation({
    summary: "Run deterministic prototype policy evaluation for a dispute",
  })
  @ApiOkResponse({ description: "Deterministic policy decision record" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only analysts can run policy evaluation",
  })
  @ApiNotFoundResponse({ description: "Dispute case not found" })
  evaluate(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.policyEvaluationService.evaluate(caseId, user);
  }

  @Get(":caseId/evaluation")
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({
    summary: "Get the latest deterministic policy evaluation for a dispute",
  })
  @ApiOkResponse({ description: "Latest deterministic policy decision record" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "User cannot read this dispute evaluation",
  })
  @ApiNotFoundResponse({ description: "Dispute case or evaluation not found" })
  evaluation(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.policyEvaluationService.getLatestEvaluation(caseId, user);
  }

  @Get(":caseId/evidence-matrix")
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({
    summary: "Get the scored evidence matrix for a dispute",
  })
  @ApiOkResponse({
    description: "Requirement-by-requirement evidence quality matrix",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "User cannot read this dispute evidence matrix",
  })
  @ApiNotFoundResponse({ description: "Dispute case not found" })
  evidenceMatrix(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.policyEvaluationService.getEvidenceMatrix(caseId, user);
  }

  @Get(":caseId/explanation")
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({
    summary: "Get the structured policy explanation for a dispute",
  })
  @ApiOkResponse({
    description: "Structured explanation generated from facts and rule results",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "User cannot read this dispute explanation",
  })
  @ApiNotFoundResponse({ description: "Dispute case or evaluation not found" })
  explanation(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.policyEvaluationService.getExplanation(caseId, user);
  }

  @Get(":caseId")
  @Roles(UserRole.CARD_MEMBER)
  @ApiOperation({
    summary: "Get one dispute for the authenticated card member",
  })
  @ApiOkResponse({ type: DisputeCaseResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only card members can read card-member disputes",
  })
  @ApiNotFoundResponse({
    description: "Dispute case not found for this card member",
  })
  findOne(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.disputesService.findOneForCardMember(caseId, user.id);
  }

  @Get(":caseId/timeline")
  @Roles(UserRole.CARD_MEMBER)
  @ApiOperation({ summary: "Get the timeline for one dispute case" })
  @ApiOkResponse({ type: TimelineEventResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  @ApiForbiddenResponse({
    description: "Only card members can read card-member timelines",
  })
  @ApiNotFoundResponse({
    description: "Dispute case not found for this card member",
  })
  timeline(
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.disputesService.findTimelineForCardMember(caseId, user.id);
  }
}
