import {
  Controller,
  Get,
  Param,
  Request,
  StreamableFile,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards';
import { AttachmentService } from './attachment.service';

@Controller('api/v1/attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentController {
  constructor(private attachmentService: AttachmentService) {}

  @Get(':id/content')
  async download(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    const result = await this.attachmentService.resolveDownload(id, req.user.userId);
    if (result.kind === 'redirect') {
      return res.redirect(result.url);
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );
    return new StreamableFile(result.stream, { type: result.mimeType });
  }
}
