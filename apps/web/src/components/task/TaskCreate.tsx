import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { useCreateTask } from '../../hooks/useTasks';

interface TaskCreateProps {
  projectId: string;
  sectionId?: string;
  onCreated?: () => void;
}

function formatApiError(err: unknown): string | null {
  if (!err) return null;
  const ax = err as { response?: { data?: { message?: string | string[] } } };
  const m = ax.response?.data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  if (err instanceof Error) return err.message;
  return null;
}

export function TaskCreate({ projectId, sectionId, onCreated }: TaskCreateProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createTask, isPending: isCreating } = useCreateTask();

  useEffect(() => {
    if (open) {
      setSaveErr(null);
      inputRef.current?.focus();
    }
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    setSaveErr(null);
    try {
      await createTask({
        title: trimmed,
        projectId,
        ...(sectionId && { sectionId }),
      });
      setTitle('');
      onCreated?.();
      inputRef.current?.focus();
    } catch (err) {
      setSaveErr(formatApiError(err) ?? 'Could not create task');
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
      setSaveErr(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600 py-1.5 px-2 rounded-md hover:bg-gray-50 w-full transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add task
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1.5 px-2 rounded-md border border-brand-400 bg-white shadow-sm">
      <div className="flex items-center gap-2">
      <Plus className="h-4 w-4 text-brand-500 flex-shrink-0" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (!title.trim()) setOpen(false); }}
        placeholder="Task name"
        disabled={isCreating}
        className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={submit}
          disabled={isCreating || !title.trim()}
          className="text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setOpen(false); setTitle(''); setSaveErr(null); }}
          className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
      </div>
      {saveErr && (
        <p role="alert" className="text-xs text-red-600 pl-6">
          {saveErr}
        </p>
      )}
    </div>
  );
}
