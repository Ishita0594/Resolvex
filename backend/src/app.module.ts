import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalystModule } from './analyst/analyst.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DisputesModule } from './disputes/disputes.module';
import { EventsModule } from './events/events.module';
import { EvidenceModule } from './evidence/evidence.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    TransactionsModule,
    DisputesModule,
    EvidenceModule,
    EventsModule,
    NotificationsModule,
    AnalystModule,
  ],
})
export class AppModule {}
