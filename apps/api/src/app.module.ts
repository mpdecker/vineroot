import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { TeamModule } from './team/team.module';
import { ProjectModule } from './project/project.module';
import { SectionModule } from './section/section.module';
import { TaskModule } from './task/task.module';
import { CommentModule } from './comment/comment.module';
import { TagModule } from './tag/tag.module';
import { CustomFieldModule } from './custom-field/custom-field.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GoalModule } from './goal/goal.module';
import { NotificationModule } from './notification/notification.module';
import { AutomationModule } from './automation/automation.module';
import { AgentModule } from './agent/agent.module';
import { ReportingModule } from './reporting/reporting.module';
import { AuditModule } from './audit/audit.module';
import { PmModule } from './pm/pm.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AttachmentModule } from './attachment/attachment.module';
import { SearchModule } from './search/search.module';
import { OutboundWebhookModule } from './outbound-webhook/outbound-webhook.module';
import { CronModule } from './cron/cron.module';
import { WorkScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 500 }],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    WorkspaceModule,
    TeamModule,
    ProjectModule,
    SectionModule,
    TaskModule,
    CommentModule,
    TagModule,
    CustomFieldModule,
    PortfolioModule,
    DashboardModule,
    GoalModule,
    NotificationModule,
    AutomationModule,
    AgentModule,
    ReportingModule,
    AuditModule,
    ActivityLogModule,
    AttachmentModule,
    SearchModule,
    PmModule,
    OutboundWebhookModule,
    CronModule,
    WorkScheduleModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
