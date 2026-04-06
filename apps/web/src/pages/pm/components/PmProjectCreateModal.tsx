import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { getPmSupabase } from '../../../lib/pmSupabase';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function toSlug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function PmProjectCreateModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  };

  const submit = async () => {
    const sb = getPmSupabase();
    if (!sb) {
      setErr('Supabase is not configured');
      return;
    }
    const s = slug.trim() || toSlug(name);
    if (!s || !name.trim()) {
      setErr('Name and slug are required');
      return;
    }
    setLoading(true);
    setErr(null);
    const { error } = await sb.from('projects').insert({
      slug: s,
      name: name.trim(),
      status: 'PHASE_0',
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setName('');
    setSlug('');
    setSlugTouched(false);
    onCreated();
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="New ModelT project">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Name</label>
          <input
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            value={name}
            onChange={(e) => handleName(e.target.value)}
            placeholder="My app"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Slug (kebab-case)</label>
          <input
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="my-app"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => void submit()}
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}
