import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigCenterModule } from './modules/config/config.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { WecomModule } from './modules/wecom/wecom.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ComputeModule } from './modules/compute/compute.module';
import { VideoModule } from './modules/video/video.module';
import { CopywritingModule } from './modules/copywriting/copywriting.module';
import { CompetitorModule } from './modules/competitor/competitor.module';
import { DigitalHumanModule } from './modules/digital-human/digital-human.module';
import { PublishModule } from './modules/publish/publish.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    ConfigCenterModule,
    UsersModule,
    DepartmentsModule,
    DashboardModule,
    WecomModule,
    AiChatModule,
    KnowledgeModule,
    ComputeModule,
    VideoModule,
    CopywritingModule,
    CompetitorModule,
    DigitalHumanModule,
    PublishModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
