import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  ProjectIntakeFormFieldDto,
  ProjectIntakeFieldMapsTo,
  ProjectIntakeFieldType,
} from '@vineroot/shared-types';
import {
  useProject,
  useProjectIntakeForm,
  usePublishProjectIntakeForm,
  useUnpublishProjectIntakeForm,
  useUpsertProjectIntakeForm,
} from '../../hooks/useProjects';
import { Button, Input } from '../../components/ui';
import { ArrowLeft, Heading2, Loader2, Plus, Trash2 } from 'lucide-react';

function newField(
  partial: Partial<ProjectIntakeFormFieldDto> &
    Pick<ProjectIntakeFormFieldDto, 'type' | 'mapsTo'>,
): ProjectIntakeFormFieldDto {
  return {
    id: crypto.randomUUID(),
    label: partial.label ?? 'Field',
    required: partial.required ?? false,
    placeholder: partial.placeholder,
    helpText: partial.helpText,
    options: partial.options,
    type: partial.type,
    mapsTo: partial.mapsTo,
    maxLength: partial.maxLength,
    min: partial.min,
    max: partial.max,
    maxFileSizeBytes: partial.maxFileSizeBytes,
    accept: partial.accept,
  };
}

function defaultFields(): ProjectIntakeFormFieldDto[] {
  return [
    newField({
      type: 'SHORT_TEXT',
      label: 'Title',
      required: true,
      mapsTo: 'TITLE',
      placeholder: 'What do you need?',
    }),
    newField({
      type: 'LONG_TEXT',
      label: 'Details',
      required: false,
      mapsTo: 'DESCRIPTION',
      placeholder: 'Add context…',
    }),
  ];
}

const FIELD_TYPES: ProjectIntakeFieldType[] = [
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
];

const MAPS_TO: ProjectIntakeFieldMapsTo[] = ['TITLE', 'DESCRIPTION', 'DETAIL', 'NONE'];

const TITLE_TYPES: ProjectIntakeFieldType[] = ['SHORT_TEXT', 'EMAIL', 'URL'];

export default function ProjectIntakeFormPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = projectId ?? '';
  const { data: project, isLoading: projectLoading } = useProject(pid);
  const { data: saved, isLoading: formLoading } = useProjectIntakeForm(pid);
  const upsert = useUpsertProjectIntakeForm(pid);
  const publish = usePublishProjectIntakeForm(pid);
  const unpublish = useUnpublishProjectIntakeForm(pid);

  const [name, setName] = useState('Intake');
  const [description, setDescription] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [fields, setFields] = useState<ProjectIntakeFormFieldDto[]>(() => defaultFields());
  const [initialized, setInitialized] = useState(false);

  const defaultSectionId = useMemo(() => {
    const secs = project?.sections ?? [];
    if (secs.length === 0) return '';
    return [...secs].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? '';
  }, [project?.sections]);

  useEffect(() => {
    if (!project || formLoading || initialized) return;
    if (saved) {
      setName(saved.name);
      setDescription(saved.description ?? '');
      setTargetSectionId(saved.targetSectionId);
      setFields(saved.fields.length ? saved.fields : defaultFields());
    } else {
      setTargetSectionId(defaultSectionId);
      setFields(defaultFields());
    }
    setInitialized(true);
  }, [project, saved, formLoading, initialized, defaultSectionId]);

  const titleField = fields.find((f) => f.mapsTo === 'TITLE');
  const canSave = Boolean(
    pid &&
      targetSectionId &&
      titleField &&
      TITLE_TYPES.includes(titleField.type),
  );

  const updateField = (id: string, patch: Partial<ProjectIntakeFormFieldDto>) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        let next = { ...f, ...patch };
        if (patch.type === 'FILE') {
          next = {
            ...next,
            mapsTo: f.mapsTo === 'TITLE' ? 'DETAIL' : next.mapsTo,
            maxLength: undefined,
            min: undefined,
            max: undefined,
            options: undefined,
          };
        }
        if (patch.type && patch.type !== 'FILE') {
          next = { ...next, maxFileSizeBytes: undefined, accept: undefined };
        }
        if (patch.type === 'HEADING') {
          next = {
            ...next,
            mapsTo: 'NONE',
            required: false,
            placeholder: undefined,
            maxLength: undefined,
            min: undefined,
            max: undefined,
            options: undefined,
          };
        }
        if (patch.type && f.type === 'HEADING' && patch.type !== 'HEADING') {
          if (next.mapsTo === 'NONE') {
            next = { ...next, mapsTo: 'DETAIL' };
          }
        }
        if (patch.mapsTo === 'TITLE') {
          next = {
            ...next,
            type: TITLE_TYPES.includes(next.type) ? next.type : 'SHORT_TEXT',
          };
        }
        if (patch.type && patch.type === 'DROPDOWN' && !patch.options) {
          next = { ...next, options: ['Option A', 'Option B'] };
        }
        if (patch.type && patch.type !== 'NUMBER') {
          next = { ...next, min: undefined, max: undefined };
        }
        if (
          patch.type &&
          !['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'URL'].includes(patch.type)
        ) {
          next = { ...next, maxLength: undefined };
        }
        return next;
      }),
    );
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      newField({
        type: 'SHORT_TEXT',
        label: 'New field',
        required: false,
        mapsTo: 'DETAIL',
      }),
    ]);
  };

  const addHeading = () => {
    setFields((prev) => [
      ...prev,
      newField({
        type: 'HEADING',
        label: 'Section title',
        required: false,
        mapsTo: 'NONE',
      }),
    ]);
  };

  const removeField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (!next.some((f) => f.mapsTo === 'TITLE')) {
        const first = next.find(
          (x) => x.type !== 'HEADING' && TITLE_TYPES.includes(x.type),
        );
        if (first) {
          return next.map((f) => (f.id === first.id ? { ...f, mapsTo: 'TITLE' as const } : f));
        }
        return [
          newField({
            type: 'SHORT_TEXT',
            label: 'Title',
            required: true,
            mapsTo: 'TITLE',
          }),
          ...next,
        ];
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    upsert.mutate({
      name: name.trim() || 'Intake',
      description: description.trim() || null,
      targetSectionId,
      fields,
    });
  };

  const publicUrl =
    saved?.publicToken && saved.isPublished
      ? `${window.location.origin}/i/${saved.publicToken}`
      : null;

  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate(`/projects/${pid}/list`)}
        >
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Intake form</h1>
      </div>
      <p className="text-sm text-gray-600">
        Publish a link so anyone can submit requests; each submission creates a task in the section
        you choose. Add section headings, checkboxes, dates, URLs, and validation hints. Project:{' '}
        <Link to={`/projects/${pid}/list`} className="text-brand-600 hover:underline">
          {project.name}
        </Link>
      </p>

      {publicUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-900 mb-1">Public link (live)</p>
          <code className="block break-all text-green-800 bg-white/60 rounded px-2 py-1 mb-2">
            {publicUrl}
          </code>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(publicUrl)}
          >
            Copy link
          </Button>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Form name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Intro (shown on public page)
          </label>
          <textarea
            className="w-full min-h-[72px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Optional instructions for people submitting the form"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Create tasks in</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            value={targetSectionId}
            onChange={(e) => setTargetSectionId(e.target.value)}
          >
            {(project.sections ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Fields</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Heading2 className="w-4 h-4" />}
              onClick={addHeading}
            >
              Add heading
            </Button>
            <Button type="button" size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={addField}>
              Add field
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Exactly one field must map to <strong>Title</strong> (short text, email, or URL). Headings
          are visual only. Other answers merge into the task description (markdown lines for detail
          fields).
        </p>

        <ul className="space-y-4">
          {fields.map((f, idx) => (
            <li
              key={f.id}
              className="rounded-lg border border-gray-100 bg-gray-50/80 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-400 font-medium">Field {idx + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-red-600"
                  onClick={() => removeField(f.id)}
                  aria-label="Remove field"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Label</label>
                  <Input
                    value={f.label}
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Type</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
                    value={f.type}
                    onChange={(e) =>
                      updateField(f.id, { type: e.target.value as ProjectIntakeFieldType })
                    }
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                {f.type !== 'HEADING' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-600">Maps to</label>
                      <select
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
                        value={f.mapsTo}
                        onChange={(e) => {
                          const mapsTo = e.target.value as ProjectIntakeFieldMapsTo;
                          if (mapsTo === 'NONE') return;
                          setFields((prev) =>
                            prev.map((x) => {
                              if (mapsTo === 'TITLE' && x.id !== f.id && x.mapsTo === 'TITLE') {
                                return { ...x, mapsTo: 'DETAIL' as const };
                              }
                              if (x.id === f.id) {
                                let nx = { ...x, mapsTo };
                                if (mapsTo === 'TITLE' && !TITLE_TYPES.includes(nx.type)) {
                                  nx = { ...nx, type: 'SHORT_TEXT' };
                                }
                                return nx;
                              }
                              return x;
                            }),
                          );
                        }}
                      >
                        {MAPS_TO.filter(
                          (m) => m !== 'NONE' && (m !== 'TITLE' || TITLE_TYPES.includes(f.type)),
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 mt-5">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-brand-600"
                        checked={f.required}
                        onChange={(e) => updateField(f.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </>
                )}
                {f.type === 'HEADING' && (
                  <p className="text-xs text-gray-500 sm:col-span-2">
                    Section headings break up the public form; they are not stored on the task.
                  </p>
                )}
              </div>
              {f.type !== 'HEADING' && (
                <>
                  <div>
                    <label className="text-xs text-gray-600">Help text (public)</label>
                    <textarea
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      rows={2}
                      value={f.helpText ?? ''}
                      onChange={(e) =>
                        updateField(f.id, {
                          helpText: e.target.value ? e.target.value : undefined,
                        })
                      }
                      placeholder="Optional hint under the label"
                      maxLength={500}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Placeholder</label>
                    <Input
                      value={f.placeholder ?? ''}
                      onChange={(e) =>
                        updateField(f.id, { placeholder: e.target.value || undefined })
                      }
                      maxLength={500}
                    />
                  </div>
                  {['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'URL'].includes(f.type) && (
                    <div>
                      <label className="text-xs text-gray-600">Max length (optional)</label>
                      <Input
                        type="number"
                        min={1}
                        max={20000}
                        value={f.maxLength ?? ''}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          updateField(f.id, {
                            maxLength: Number.isFinite(n) && n >= 1 ? Math.min(20000, n) : undefined,
                          });
                        }}
                        placeholder="e.g. 120"
                      />
                    </div>
                  )}
                  {f.type === 'NUMBER' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600">Min (optional)</label>
                        <Input
                          type="number"
                          value={f.min ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateField(f.id, {
                              min: v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v),
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Max (optional)</label>
                        <Input
                          type="number"
                          value={f.max ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateField(f.id, {
                              max: v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v),
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {f.type === 'DROPDOWN' && (
                    <div>
                      <label className="text-xs text-gray-600">Options (one per line)</label>
                      <textarea
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono"
                        rows={4}
                        value={(f.options ?? []).join('\n')}
                        onChange={(e) =>
                          updateField(f.id, {
                            options: e.target.value
                              .split('\n')
                              .map((l) => l.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  )}
                  {f.type === 'FILE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:col-span-2">
                      <div>
                        <label className="text-xs text-gray-600">
                          Max size (MB, optional; default 5)
                        </label>
                        <Input
                          type="number"
                          min={0.001}
                          max={25}
                          step={0.5}
                          value={
                            f.maxFileSizeBytes != null
                              ? Math.round((f.maxFileSizeBytes / (1024 * 1024)) * 1000) / 1000
                              : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              updateField(f.id, { maxFileSizeBytes: undefined });
                              return;
                            }
                            const mb = parseFloat(v);
                            if (!Number.isFinite(mb) || mb <= 0) return;
                            const bytes = Math.round(mb * 1024 * 1024);
                            if (bytes >= 1024 && bytes <= 25 * 1024 * 1024) {
                              updateField(f.id, { maxFileSizeBytes: bytes });
                            }
                          }}
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Accept (optional)</label>
                        <Input
                          value={f.accept ?? ''}
                          onChange={(e) =>
                            updateField(f.id, {
                              accept: e.target.value.trim()
                                ? e.target.value.trim().slice(0, 500)
                                : undefined,
                            })
                          }
                          placeholder="image/*,.pdf"
                          maxLength={500}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" onClick={handleSave} disabled={!canSave || upsert.isPending} loading={upsert.isPending}>
          Save draft
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => publish.mutate()}
          disabled={!saved || publish.isPending}
          loading={publish.isPending}
        >
          Publish
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => unpublish.mutate()}
          disabled={!saved?.isPublished || unpublish.isPending}
          loading={unpublish.isPending}
        >
          Unpublish
        </Button>
      </div>
      {(upsert.error || publish.error || unpublish.error) && (
        <p className="text-sm text-red-600">
          {(upsert.error as Error)?.message ||
            (publish.error as Error)?.message ||
            (unpublish.error as Error)?.message}
        </p>
      )}
    </div>
  );
}
