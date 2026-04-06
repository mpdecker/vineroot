import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectIntakeFormService } from './project-intake-form.service';

const titleField = {
  id: 'fld-title',
  type: 'SHORT_TEXT',
  label: 'Title',
  required: true,
  mapsTo: 'TITLE',
};
const descField = {
  id: 'fld-desc',
  type: 'LONG_TEXT',
  label: 'Details',
  required: false,
  mapsTo: 'DESCRIPTION',
};

describe('ProjectIntakeFormService', () => {
  const prisma = {
    project: { findFirst: jest.fn() },
    projectIntakeForm: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    section: { findFirst: jest.fn() },
    task: { update: jest.fn() },
  };

  const taskService = { create: jest.fn() };
  const intakeRecaptcha = { verifyOptional: jest.fn(), siteKey: jest.fn() };
  const attachmentService = { saveUploadBuffer: jest.fn() };
  const config = { get: jest.fn() };

  let service: ProjectIntakeFormService;

  beforeEach(() => {
    jest.clearAllMocks();
    intakeRecaptcha.verifyOptional.mockResolvedValue(undefined);
    intakeRecaptcha.siteKey.mockReturnValue(undefined);
    config.get.mockReturnValue(undefined);
    service = new ProjectIntakeFormService(
      prisma as any,
      taskService as any,
      intakeRecaptcha as any,
      attachmentService as any,
      config as any,
    );
  });

  it('getPublicByToken throws when not found', async () => {
    prisma.projectIntakeForm.findFirst.mockResolvedValue(null);
    await expect(service.getPublicByToken('bad')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getPublicByToken includes captchaSiteKey when configured', async () => {
    intakeRecaptcha.siteKey.mockReturnValue('site-key');
    prisma.projectIntakeForm.findFirst.mockResolvedValue({
      publicToken: 't',
      isPublished: true,
      name: 'F',
      description: null,
      fields: [titleField, descField],
      project: { name: 'P' },
    });

    const dto = await service.getPublicByToken('t');
    expect(dto.captchaSiteKey).toBe('site-key');
  });

  it('submitPublic throws when title value missing', async () => {
    prisma.projectIntakeForm.findFirst.mockResolvedValue({
      publicToken: 't',
      isPublished: true,
      targetSectionId: 'sec1',
      createdById: 'admin',
      fields: [titleField, descField],
      project: { id: 'p1' },
    });

    await expect(
      service.submitPublic('t', { 'fld-title': '', 'fld-desc': '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submitPublic creates task with mapped title', async () => {
    prisma.projectIntakeForm.findFirst.mockResolvedValue({
      publicToken: 't',
      isPublished: true,
      targetSectionId: 'sec1',
      createdById: 'admin',
      fields: [titleField, descField],
      project: { id: 'p1' },
    });
    taskService.create.mockResolvedValue({ id: 'task-new' });

    const r = await service.submitPublic('t', {
      'fld-title': 'From intake',
      'fld-desc': '',
    });

    expect(r).toEqual({ success: true });
    expect(taskService.create).toHaveBeenCalledWith(
      'p1',
      'admin',
      expect.objectContaining({
        title: 'From intake',
        sectionId: 'sec1',
      }),
    );
  });

  it('submitPublic uploads FILE data URLs and appends attachment block', async () => {
    const fileField = {
      id: 'fld-file',
      type: 'FILE',
      label: 'Screenshot',
      required: false,
      mapsTo: 'DETAIL',
    };
    const b64 = Buffer.from('hello').toString('base64');
    const dataUrl = `data:text/plain;base64,${b64}`;

    prisma.projectIntakeForm.findFirst.mockResolvedValue({
      publicToken: 't',
      isPublished: true,
      targetSectionId: 'sec1',
      createdById: 'admin',
      fields: [titleField, descField, fileField],
      project: { id: 'p1' },
    });
    taskService.create.mockResolvedValue({
      id: 'task-new',
      description: 'base\n\n_Submitted via intake form._',
    });
    attachmentService.saveUploadBuffer.mockResolvedValue('att-uuid');

    await service.submitPublic('t', {
      'fld-title': 'T',
      'fld-desc': '',
      'fld-file': dataUrl,
    });

    expect(attachmentService.saveUploadBuffer).toHaveBeenCalled();
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-new' },
        data: expect.objectContaining({
          description: expect.stringContaining('Form attachments'),
        }),
      }),
    );
  });
});
