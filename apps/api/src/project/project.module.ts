import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { ProjectResourceController } from './project-resource.controller';
import { PublicIntakeFormController } from './public-intake-form.controller';
import { ProjectIntakeFormService } from './project-intake-form.service';
import { PrismaService } from '../common/prisma.service';
import { TaskModule } from '../task/task.module';
import { WorkspaceGuard } from '../auth/guards';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { IntakeRecaptchaService } from './intake-recaptcha.service';
import { CustomFieldModule } from '../custom-field/custom-field.module';

@Module({
  imports: [TaskModule, ActivityLogModule, AttachmentModule, CustomFieldModule],
  controllers: [
    ProjectController,
    ProjectResourceController,
    PublicIntakeFormController,
  ],
  providers: [
    ProjectService,
    ProjectIntakeFormService,
    IntakeRecaptchaService,
    PrismaService,
    WorkspaceGuard,
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
