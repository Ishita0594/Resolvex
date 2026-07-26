import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadTargetDto } from './dto/create-upload-target.dto';
import { UpdateFactsDto } from './dto/update-facts.dto';
import { AiProcessingService } from './ai-processing.service';
import { EvidenceService } from './evidence.service';

type UploadedEvidenceFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes/:caseId/evidence')
export class CaseEvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload-target')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT)
  @ApiOperation({ summary: 'Create a short-lived upload target for case evidence' })
  createUploadTarget(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateUploadTargetDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.evidenceService.createUploadTarget(caseId, user, dto);
  }

  @Post('confirm')
  @HttpCode(200)
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT)
  @ApiOperation({ summary: 'Confirm a completed evidence upload and persist its file hash' })
  confirmUpload(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.evidenceService.confirmUpload(caseId, user, dto);
  }

  @Get()
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'List evidence metadata for one dispute case' })
  listForCase(@Param('caseId', ParseUUIDPipe) caseId: string, @CurrentUser() user: PublicUser) {
    return this.evidenceService.listForCase(caseId, user);
  }
}

@ApiTags('Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly aiProcessingService: AiProcessingService,
  ) {}

  @Get(':evidenceId')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'Get one evidence metadata record' })
  @ApiOkResponse({ description: 'Evidence metadata' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Authenticated user cannot modify this evidence' })
  @ApiNotFoundResponse({ description: 'Evidence not found or not visible to the user' })
  findOne(@Param('evidenceId', ParseUUIDPipe) evidenceId: string, @CurrentUser() user: PublicUser) {
    return this.evidenceService.findOne(evidenceId, user);
  }

  @Get(':evidenceId/download')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'Create a short-lived evidence download URL' })
  createDownloadUrl(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.evidenceService.createTemporaryDownload(evidenceId, user);
  }

  @Post(':evidenceId/process')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'Process uploaded evidence into structured facts' })
  processEvidence(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.aiProcessingService.processEvidence(evidenceId, user);
  }

  @Post(':evidenceId/retry')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'Retry failed evidence processing' })
  retryProcessing(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.aiProcessingService.processEvidence(evidenceId, user, true);
  }

  @Get(':evidenceId/facts')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'List extracted facts for one evidence item' })
  listFacts(@Param('evidenceId', ParseUUIDPipe) evidenceId: string, @CurrentUser() user: PublicUser) {
    return this.aiProcessingService.listFacts(evidenceId, user);
  }

  @Patch(':evidenceId/facts')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT, UserRole.ANALYST)
  @ApiOperation({ summary: 'Replace extracted facts for one evidence item' })
  replaceFacts(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: UpdateFactsDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.evidenceService.replaceFacts(evidenceId, user, dto);
  }

  @Delete(':evidenceId')
  @HttpCode(204)
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT)
  @ApiOperation({ summary: 'Delete a submitted evidence item when case rules allow it' })
  async deleteEvidence(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: PublicUser,
  ) {
    await this.evidenceService.deleteEvidence(evidenceId, user);
  }

  @Post(':evidenceId/local-upload')
  @Roles(UserRole.CARD_MEMBER, UserRole.MERCHANT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Local development multipart evidence upload target' })
  uploadLocalMultipart(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @UploadedFile() file: UploadedEvidenceFile | undefined,
    @CurrentUser() user: PublicUser,
  ) {
    return this.evidenceService.saveLocalMultipartUpload(evidenceId, user, file);
  }
}

@ApiTags('Evidence')
@Controller('evidence')
export class EvidenceTemporaryDownloadController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get(':evidenceId/download-content')
  @Header('Cache-Control', 'private, max-age=0, no-store')
  @ApiOperation({ summary: 'Local temporary evidence download content endpoint' })
  async downloadLocalContent(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ) {
    const download = await this.evidenceService.getLocalDownloadStream(evidenceId, expires, signature);
    response.setHeader('Content-Type', download.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName.replace(/"/g, '')}"`);
    download.stream.pipe(response);
  }
}
