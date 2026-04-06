import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  ProjectIntakeFormFieldDto,
  PublicProjectIntakeFormDto,
} from '@vineroot/shared-types';
import { Button, Input } from '../../components/ui';
import { Loader2 } from 'lucide-react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as object),
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const raw =
      typeof data === 'object' && data && 'message' in data
        ? (data as { message: unknown }).message
        : res.statusText;
    const msg = Array.isArray(raw) ? raw.join(', ') : String(raw);
    throw new Error(msg);
  }
  return data as T;
}

const DEFAULT_FILE_MAX = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return Promise.reject(new Error(`File too large (max ${mb} MB)`));
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
};

function loadRecaptchaV3(siteKey: string): void {
  const id = 'grecaptcha-v3';
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  script.async = true;
  document.head.appendChild(script);
}

export default function PublicIntakeFormPage() {
  const { token } = useParams<{ token: string }>();
  const t = token?.trim() ?? '';
  const [form, setForm] = useState<PublicProjectIntakeFormDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const captchaKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!t) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson<PublicProjectIntakeFormDto>(
          `/api/v1/public/intake-forms/${encodeURIComponent(t)}`,
        );
        if (!cancelled) {
          setForm(data);
          const init: Record<string, string> = {};
          for (const f of data.fields) {
            if (f.type !== 'HEADING') init[f.id] = '';
          }
          setValues(init);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load form');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const key = form?.captchaSiteKey?.trim();
    if (!key) {
      captchaKeyRef.current = null;
      return;
    }
    captchaKeyRef.current = key;
    loadRecaptchaV3(key);
  }, [form?.captchaSiteKey]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!t || !form) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let captchaToken: string | undefined;
      const siteKey = captchaKeyRef.current;
      if (siteKey) {
        const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
        if (!g) {
          throw new Error('Captcha is still loading; wait a moment and try again.');
        }
        captchaToken = await new Promise<string>((resolve, reject) => {
          g.ready(() => {
            g.execute(siteKey, { action: 'intake_submit' }).then(resolve).catch(reject);
          });
        });
      }

      await fetchJson<{ success: true }>(`/api/v1/public/intake-forms/${encodeURIComponent(t)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ values, captchaToken }),
      });
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = (f: ProjectIntakeFormFieldDto) => {
    const v = values[f.id] ?? '';
    const maxLen = f.maxLength;
    const commonText = {
      required: f.required,
      placeholder: f.placeholder,
      value: v,
      maxLength: maxLen,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValues((prev) => ({ ...prev, [f.id]: e.target.value })),
    };
    if (f.type === 'LONG_TEXT') {
      return (
        <textarea
          className="w-full min-h-[100px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
          {...commonText}
        />
      );
    }
    if (f.type === 'DROPDOWN') {
      return (
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          required={f.required}
          value={v}
          onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
        >
          <option value="">Choose…</option>
          {(f.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === 'CHECKBOX') {
      const checked = v === 'true' || v === '1' || v === 'on';
      return (
        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            checked={checked}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                [f.id]: e.target.checked ? 'true' : '',
              }))
            }
          />
          <span>{f.placeholder || 'Yes'}</span>
        </label>
      );
    }
    if (f.type === 'DATE') {
      return (
        <input
          type="date"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          required={f.required}
          value={v}
          onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
        />
      );
    }
    if (f.type === 'FILE') {
      const maxB = f.maxFileSizeBytes ?? DEFAULT_FILE_MAX;
      return (
        <div className="space-y-1">
          <input
            type="file"
            accept={f.accept}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                setValues((prev) => ({ ...prev, [f.id]: '' }));
                return;
              }
              void readFileAsDataUrl(file, maxB)
                .then((dataUrl) => setValues((prev) => ({ ...prev, [f.id]: dataUrl })))
                .catch((err) => {
                  setSubmitError(err instanceof Error ? err.message : 'File error');
                  e.target.value = '';
                });
            }}
          />
          {v ? (
            <p className="text-xs text-gray-500">File ready to submit.</p>
          ) : null}
        </div>
      );
    }
    return (
      <Input
        type={f.type === 'EMAIL' ? 'email' : f.type === 'NUMBER' ? 'number' : f.type === 'URL' ? 'url' : 'text'}
        {...commonText}
        min={f.type === 'NUMBER' && f.min != null ? f.min : undefined}
        max={f.type === 'NUMBER' && f.max != null ? f.max : undefined}
      />
    );
  };

  if (!t) {
    return <p className="p-8 text-center text-gray-600">Invalid link.</p>;
  }

  if (loadError) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <p className="text-red-600 text-center max-w-md">{loadError}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-xl font-semibold text-gray-900">Thanks!</h1>
          <p className="text-gray-600">Your submission was received.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{form.projectName}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{form.formName}</h1>
          {form.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{form.description}</p>}
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {form.fields.map((f, idx) =>
            f.type === 'HEADING' ? (
              <div
                key={f.id}
                className={idx > 0 ? 'pt-4 mt-2 border-t border-gray-100' : 'pt-1'}
              >
                <h2 className="text-base font-semibold text-gray-900">{f.label}</h2>
                {f.helpText && <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>}
              </div>
            ) : (
              <div key={f.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label}
                  {f.required && f.type !== 'CHECKBOX' && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </label>
                {f.helpText && (
                  <p className="text-xs text-gray-500 mb-1.5 whitespace-pre-wrap">{f.helpText}</p>
                )}
                {renderInput(f)}
              </div>
            ),
          )}
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}
