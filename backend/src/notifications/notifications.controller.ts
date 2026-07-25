import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../users/public-user.type';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiOkResponse({ description: 'Notification list' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  list(@CurrentUser() user: PublicUser) {
    return this.notificationsService.listForUser(user);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications read for the authenticated user',
  })
  @ApiOkResponse({ description: 'Read count' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  readAll(@CurrentUser() user: PublicUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  @ApiOkResponse({ description: 'Updated notification' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiNotFoundResponse({ description: 'Notification not found for this user' })
  readOne(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: PublicUser,
  ) {
    return this.notificationsService.markRead(notificationId, user);
  }
}
