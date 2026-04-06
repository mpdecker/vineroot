import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type {
  ProjectIntakeFormDto,
  ProjectIntakeFormFieldDto,
  PublicProjectIntakeFormDto,
  UpsertProjectIntakeFormRequest,
} from '@vineroot/shared-types';
import { assertAttachmentUploadAllowed } from '../attachment/attachment-upload-policy';
import { AttachmentService } from '../attachment/attachment.service';
import { PrismaService } from '../common/prisma.service';
import { TaskService } from '../task/task.service';
import { intakeFileDisplayName, parseIntakeFileDataUrl } from './intake-file.util';
import { IntakeRecaptchaService } from './intake-recaptcha.service';

const MAX_FIELDS = 20;
const DEFAULT_INTAKE_FILE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_INTAKE_FILE_BYTES = 25 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_TYPES = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'EMAIL',
  'NUMBER',
  'DROPDOWN',
  'CHECKBOX',
  'DATE',
  'URL',
  'FILE',
  'HEADING',
] as const;

function defaultFields(): ProjectIntakeFormFieldDto[] {
  return [
    {
      id: randomUUID(),
      type: 'SHORT_TEXT',
      label: 'Title',
      required: true,
      mapsTo: 'TITLE',
      placeholder: 'What do you need?',
    },
    {
      id: randomUUID(),
      type: 'LONG_TEXT',
      label: 'Details',
      required: false,
      mapsTo: 'DESCRIPTION',
      placeholder: 'Add context…',
    },
  ];
}

function isIsoCalendarDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeField(raw: unknown): ProjectIntakeFormFieldDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : null;
  if (!id) return null;

  let type: string =
    typeof r.type === 'string' && ALLOWED_TYPES.includes(r.type as (typeof ALLOWED_TYPES)[number])
      ? r.type
      : 'SHORT_TEXT';

  let mapsTo: string =
    typeof r.mapsTo === 'string' ? r.mapsTo : 'DETAIL';
  if (type === 'HEADING') {
    mapsTo = 'NONE';
  }
  if (!['TITLE', 'DESCRIPTION', 'DETAIL', 'NONE'].includes(mapsTo)) {
    mapsTo = 'DETAIL';
  }

  const label = typeof r.label === 'string' ? r.label : 'Field';
  const required = Boolean(r.required);
  const placeholder =
    typeof r.placeholder === 'string' && r.placeholder.trim()
      ? r.placeholder
      : undefined;
  const helpText =
    typeof r.helpText === 'string' && r.helpText.trim() ? r.helpText.trim() : undefined;

  const options = Array.isArray(r.options)
    ? r.options.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;

  let maxLength: number | undefined;
  if (typeof r.maxLength === 'number' && Number.isInteger(r.maxLength)) {
    const n = r.maxLength;
    if (n >= 1 && n <= 20000) maxLength = n;
  }

  let min: number | undefined;
  let max: number | undefined;
  if (typeof r.min === 'number' && Number.isFinite(r.min)) min = r.min;
  if (typeof r.max === 'number' && Number.isFinite(r.max)) max = r.max;

  let maxFileSizeBytes: number | undefined;
  let accept: string | undefined;
  if (type === 'FILE') {
    if (typeof r.maxFileSizeBytes === 'number' && Number.isInteger(r.maxFileSizeBytes)) {
      const n = r.maxFileSizeBytes;
      if (n >= 1024 && n <= MAX_INTAKE_FILE_BYTES) maxFileSizeBytes = n;
    }
    if (typeof r.accept === 'string' && r.accept.trim()) {
      accept = r.accept.trim().slice(0, 500);
    }
  }

  return {
    id,
    type: type as ProjectIntakeFormFieldDto['type'],
    label,
    required: type === 'HEADING' ? false : required,
    placeholder,
    helpText,
    options,
    mapsTo: mapsTo as ProjectIntakeFormFieldDto['mapsTo'],
    maxLength,
    min,
    max,
    maxFileSizeBytes,
    accept,
  };
}

function parseFields(raw: unknown): ProjectIntakeFormFieldDto[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectIntakeFormFieldDto[] = [];
  for (const item of raw) {
    const f = normalizeField(item);
    if (f) out.push(f);
  }
  return out;
}

@Injectable()
export class ProjectIntakeFormService {
  constructor(
    private prisma: PrismaService,
    private taskService: TaskService,
    private intakeRecaptcha: IntakeRecaptchaService,
    private attachmentService: AttachmentService,
    private config: ConfigService,
  ) {}

  private validateFields(fields: ProjectIntakeFormFieldDto[]): void {
    if (fields.length < 1 || fields.length > MAX_FIELDS) {
      throw new BadRequestException(
        `Form must have between 1 and ${MAX_FIELDS} fields`,
      );
    }
    const ids = new Set<string>();
    let titleCount = 0;
    for (const f of fields) {
      if (!f.id || typeof f.id !== 'string') {
        throw new BadRequestException('Each field needs a stable id');
      }
      if (ids.has(f.id)) {
        throw new BadRequestException('Duplicate field id');
      }
      ids.add(f.id);
      if (!f.label?.trim()) {
        throw new BadRequestException('Each field needs a label');
      }

      if (!ALLOWED_TYPES.includes(f.type as (typeof ALLOWED_TYPES)[number])) {
        throw new BadRequestException(`Invalid field type: ${f.type}`);
      }

      if (f.type === 'HEADING') {
        if (f.mapsTo !== 'NONE') {
          throw new BadRequestException('Heading fields must use mapsTo NONE');
        }
        continue;
      }

      if (f.mapsTo === 'NONE') {
        throw new BadRequestException('mapsTo NONE is only for HEADING fields');
      }

      const maps = ['TITLE', 'DESCRIPTION', 'DETAIL'];
      if (!maps.includes(f.mapsTo)) {
        throw new BadRequestException(`Invalid mapsTo: ${f.mapsTo}`);
      }

      if (f.mapsTo === 'TITLE') {
        titleCount += 1;
        if (f.type !== 'SHORT_TEXT' && f.type !== 'EMAIL' && f.type !== 'URL') {
          throw new BadRequestException(
            'The title field must be short text, email, or URL',
          );
        }
      }

      if (f.type === 'DROPDOWN') {
        const opts = f.options?.filter((o) => o.trim()) ?? [];
        if (opts.length < 2) {
          throw new BadRequestException(
            'Dropdown fields need at least two options',
          );
        }
      }

      if (f.type === 'CHECKBOX' && f.mapsTo === 'TITLE') {
        throw new BadRequestException('A checkbox cannot map to the task title');
      }

      if (f.type === 'FILE' && f.mapsTo === 'TITLE') {
        throw new BadRequestException('A file field cannot map to the task title');
      }

      if (f.type === 'FILE') {
        if (f.maxFileSizeBytes != null) {
          if (
            !Number.isInteger(f.maxFileSizeBytes) ||
            f.maxFileSizeBytes < 1024 ||
            f.maxFileSizeBytes > MAX_INTAKE_FILE_BYTES
          ) {
            throw new BadRequestException(
              `maxFileSizeBytes must be an integer between 1024 and ${MAX_INTAKE_FILE_BYTES}`,
            );
          }
        }
        if (f.accept != null && f.accept.length > 500) {
          throw new BadRequestException('accept string is too long');
        }
      }

      if (f.maxLength != null) {
        const textish = [
          'SHORT_TEXT',
          'LONG_TEXT',
          'EMAIL',
          'URL',
        ] as const;
        if (!textish.includes(f.type as (typeof textish)[number])) {
          throw new BadRequestException(
            'maxLength applies only to text, email, or URL fields',
          );
        }
      }

      if (f.min != null || f.max != null) {
        if (f.type !== 'NUMBER') {
          throw new BadRequestException('min/max apply only to NUMBER fields');
        }
        if (f.min != null && f.max != null && f.min > f.max) {
          throw new BadRequestException('Number min cannot exceed max');
        }
      }
    }
    if (titleCount !== 1) {
      throw new BadRequestException('Form must have exactly one title field');
    }
  }

  private toDto(row: {
    projectId: string;
    name: string;
    description: string | null;
    targetSectionId: string;
    fields: unknown;
    isPublished: boolean;
    publicToken: string | null;
  }): ProjectIntakeFormDto {
    return {
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      targetSectionId: row.targetSectionId,
      fields: parseFields(row.fields),
      isPublished: row.isPublished,
      publicToken: row.publicToken,
    };
  }

  async getForProject(
    projectId: string,
    userId: string,
  ): Promise<ProjectIntakeFormDto | null> {
    await this.assertProjectAccess(projectId, userId);
    const row = await this.prisma.projectIntakeForm.findUnique({
      where: { projectId },
    });
    if (!row) return null;
    return this.toDto(row);
  }

  async upsert(
    projectId: string,
    userId: string,
    body: UpsertProjectIntakeFormRequest,
  ): Promise<ProjectIntakeFormDto> {
    await this.assertProjectAccess(projectId, userId);
    const fields = body.fields?.length ? parseFields(body.fields) : defaultFields();
    this.validateFields(fields);

    const section = await this.prisma.section.findFirst({
      where: { id: body.targetSectionId, projectId },
    });
    if (!section) {
      throw new BadRequestException('Target section not found in this project');
    }

    const name = body.name?.trim() || 'Intake';

    const row = await this.prisma.projectIntakeForm.upsert({
      where: { projectId },
      create: {
        projectId,
        createdById: userId,
        name,
        description: body.description?.trim() || null,
        targetSectionId: body.targetSectionId,
        fields: fields as object[],
        isPublished: false,
        publicToken: null,
      },
      update: {
        name,
        description: body.description?.trim() || null,
        targetSectionId: body.targetSectionId,
        fields: fields as object[],
      },
    });

    return this.toDto(row);
  }

  async publish(projectId: string, userId: string): Promise<ProjectIntakeFormDto> {
    await this.assertProjectAccess(projectId, userId);
    const existing = await this.prisma.projectIntakeForm.findUnique({
      where: { projectId },
    });
    if (!existing) {
      throw new BadRequestException('Save the form before publishing');
    }
    const fields = parseFields(existing.fields);
    this.validateFields(fields);

    const token = existing.publicToken ?? randomUUID();
    const row = await this.prisma.projectIntakeForm.update({
      where: { projectId },
      data: {
        isPublished: true,
        publicToken: token,
      },
    });
    return this.toDto(row);
  }

  async unpublish(
    projectId: string,
    userId: string,
  ): Promise<ProjectIntakeFormDto> {
    await this.assertProjectAccess(projectId, userId);
    const existing = await this.prisma.projectIntakeForm.findUnique({
      where: { projectId },
    });
    if (!existing) {
      throw new NotFoundException('Intake form not found');
    }
    const row = await this.prisma.projectIntakeForm.update({
      where: { projectId },
      data: { isPublished: false },
    });
    return this.toDto(row);
  }

  async getPublicByToken(token: string): Promise<PublicProjectIntakeFormDto> {
    const row = await this.prisma.projectIntakeForm.findFirst({
      where: {
        publicToken: token,
        isPublished: true,
        project: { deletedAt: null },
      },
      include: {
        project: { select: { name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Form not found');
    }
    const siteKey = this.intakeRecaptcha.siteKey();
    return {
      projectName: row.project.name,
      formName: row.name,
      description: row.description,
      fields: parseFields(row.fields),
      captchaSiteKey: siteKey ?? null,
    };
  }

  async submitPublic(
    token: string,
    values: Record<string, string>,
    captchaToken?: string,
  ): Promise<{ success: true }> {
    const row = await this.prisma.projectIntakeForm.findFirst({
      where: {
        publicToken: token,
        isPublished: true,
        project: { deletedAt: null },
      },
      include: {
        project: { select: { id: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Form not found');
    }

    await this.intakeRecaptcha.verifyOptional(captchaToken);

    const fields = parseFields(row.fields);
    this.validateFields(fields);

    const stagedFiles: Array<{
      label: string;
      buffer: Buffer;
      mime: string;
      filename: string;
    }> = [];

    const allowExec = this.config.get<string>('ATTACHMENT_ALLOW_EXECUTABLES') === '1';

    for (const f of fields) {
      if (f.type === 'HEADING') continue;

      const raw = values[f.id];
      if (f.type === 'CHECKBOX') {
        const checked =
          raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes';
        if (f.required && !checked) {
          throw new BadRequestException(`Required: ${f.label}`);
        }
        continue;
      }

      if (f.type === 'FILE') {
        const v = raw == null ? '' : String(raw).trim();
        if (f.required && !v) {
          throw new BadRequestException(`Required: ${f.label}`);
        }
        if (!v) continue;
        const parsed = parseIntakeFileDataUrl(v);
        if (!parsed) {
          throw new BadRequestException(`Invalid file data for: ${f.label}`);
        }
        const maxB = f.maxFileSizeBytes ?? DEFAULT_INTAKE_FILE_MAX_BYTES;
        if (parsed.buffer.length > maxB) {
          throw new BadRequestException(`${f.label} exceeds maximum size`);
        }
        const filename = intakeFileDisplayName(f.id, parsed.mime);
        assertAttachmentUploadAllowed(parsed.mime, filename, allowExec);
        stagedFiles.push({
          label: f.label,
          buffer: parsed.buffer,
          mime: parsed.mime,
          filename,
        });
        continue;
      }

      const v = raw == null ? '' : String(raw).trim();
      if (f.required && !v) {
        throw new BadRequestException(`Required: ${f.label}`);
      }
      if (!v) continue;

      if (f.maxLength != null && v.length > f.maxLength) {
        throw new BadRequestException(`${f.label} is too long`);
      }

      if (f.type === 'EMAIL' && !EMAIL_RE.test(v)) {
        throw new BadRequestException(`Invalid email: ${f.label}`);
      }
      if (f.type === 'URL' && !isValidHttpUrl(v)) {
        throw new BadRequestException(`Invalid URL: ${f.label}`);
      }
      if (f.type === 'NUMBER') {
        const n = Number(v);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(`Invalid number: ${f.label}`);
        }
        if (f.min != null && n < f.min) {
          throw new BadRequestException(`${f.label} is below minimum`);
        }
        if (f.max != null && n > f.max) {
          throw new BadRequestException(`${f.label} is above maximum`);
        }
      }
      if (f.type === 'DATE' && !isIsoCalendarDate(v)) {
        throw new BadRequestException(`Invalid date: ${f.label}`);
      }
      if (f.type === 'DROPDOWN') {
        const opts = f.options?.map((o) => o.trim()) ?? [];
        if (!opts.includes(v)) {
          throw new BadRequestException(`Invalid choice: ${f.label}`);
        }
      }
    }

    let title = '';
    const descParts: string[] = [];
    const detailLines: string[] = [];

    for (const f of fields) {
      if (f.type === 'HEADING') continue;

      if (f.type === 'CHECKBOX') {
        const raw = values[f.id];
        const checked =
          raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes';
        if (!checked && !f.required) {
          continue;
        }
        const line = `**${f.label}:** ${checked ? 'Yes' : 'No'}`;
        if (f.mapsTo === 'DESCRIPTION') {
          descParts.push(line);
        } else if (f.mapsTo === 'DETAIL') {
          detailLines.push(line);
        }
        continue;
      }

      if (f.type === 'FILE') continue;

      const raw = values[f.id];
      const v = raw == null ? '' : String(raw).trim();
      if (!v) continue;

      if (f.mapsTo === 'TITLE') {
        title = v;
      } else if (f.mapsTo === 'DESCRIPTION') {
        descParts.push(v);
      } else {
        detailLines.push(`**${f.label}:** ${v}`);
      }
    }

    if (!title) {
      throw new BadRequestException('Title is required');
    }

    let description =
      descParts.length > 0 ? descParts.join('\n\n') : undefined;
    if (detailLines.length > 0) {
      const block = detailLines.join('\n');
      description = description ? `${description}\n\n${block}` : block;
    }
    description = description
      ? `${description}\n\n_Submitted via intake form._`
      : '_Submitted via intake form._';

    const created = await this.taskService.create(row.project.id, row.createdById, {
      title,
      description,
      sectionId: row.targetSectionId,
    });

    if (stagedFiles.length > 0) {
      const lines: string[] = [];
      for (const sf of stagedFiles) {
        const attachmentId = await this.attachmentService.saveUploadBuffer(
          created.id,
          row.createdById,
          sf.buffer,
          sf.filename,
          sf.mime,
        );
        lines.push(
          `- **${sf.label}:** [${sf.filename}](/api/v1/attachments/${attachmentId}/content)`,
        );
      }
      const block = `\n\n**Form attachments:**\n${lines.join('\n')}`;
      await this.prisma.task.update({
        where: { id: created.id },
        data: { description: `${created.description ?? ''}${block}` },
      });
    }

    return { success: true };
  }

  private async assertProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const p = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [{ createdById: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    if (!p) {
      throw new NotFoundException('Project not found');
    }
  }
}
