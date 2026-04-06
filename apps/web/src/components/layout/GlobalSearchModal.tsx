import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Folder, LayoutList, Search, Tag, X } from 'lucide-react';
import type {
  SearchProjectHitDto,
  SearchSectionHitDto,
  SearchTagHitDto,
  SearchTaskHitDto,
} from '@vineroot/shared-types';
import { clsx } from 'clsx';
import { useUIStore } from '../../stores/ui.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useWorkspaceSearch } from '../../hooks/useSearch';

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const tokens = useMemo(() => {
    const t = query
      .trim()
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    return t;
  }, [query]);

  if (tokens.length === 0) {
    return <>{text}</>;
  }

  const r = new RegExp(`(${tokens.map(escapeRegex).join('|')})`, 'gi');
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    }
    nodes.push(
      <mark
        key={k++}
        className="bg-amber-100/90 text-inherit rounded px-0.5"
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) r.lastIndex++;
  }
  if (last < text.length) {
    nodes.push(<span key={k++}>{text.slice(last)}</span>);
  }
  return <>{nodes}</>;
}

type PickRow =
  | { type: 'task'; id: string; task: SearchTaskHitDto }
  | { type: 'project'; id: string; project: SearchProjectHitDto }
  | { type: 'section'; id: string; section: SearchSectionHitDto }
  | { type: 'tag'; id: string; tag: SearchTagHitDto };

export function GlobalSearchModal() {
  const { searchOpen, closeSearch, openTask } = useUIStore();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebouncedValue(input, 280);
  const { data, isFetching, isError } = useWorkspaceSearch(debounced, currentWorkspace?.id);

  const pickables = useMemo<PickRow[]>(() => {
    if (!data) return [];
    const rows: PickRow[] = [];
    for (const t of data.tasks) rows.push({ type: 'task', id: t.id, task: t });
    for (const p of data.projects) rows.push({ type: 'project', id: p.id, project: p });
    for (const s of data.sections ?? []) rows.push({ type: 'section', id: s.id, section: s });
    for (const g of data.tags ?? []) rows.push({ type: 'tag', id: g.id, tag: g });
    return rows;
  }, [data]);

  const indexByKey = useMemo(() => {
    const m = new Map<string, number>();
    pickables.forEach((row, i) => m.set(`${row.type}:${row.id}`, i));
    return m;
  }, [pickables]);

  useEffect(() => {
    if (searchOpen) {
      setInput('');
      setSelectedIndex(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debounced]);

  useEffect(() => {
    if (pickables.length === 0) return;
    setSelectedIndex((i) => Math.min(i, pickables.length - 1));
  }, [pickables.length]);

  useEffect(() => {
    if (!searchOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSearch();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    if (pickables.length === 0) return;
    const el = listRef.current?.querySelector(`[data-pick-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, pickables.length, data]);

  if (!searchOpen) return null;

  const pickTask = (t: SearchTaskHitDto) => {
    closeSearch();
    if (t.projectId) {
      navigate(`/projects/${t.projectId}/list`);
      openTask(t.id);
    } else {
      navigate('/my-tasks');
      openTask(t.id);
    }
  };

  const pickProject = (p: SearchProjectHitDto) => {
    closeSearch();
    navigate(`/projects/${p.id}/list`);
  };

  const pickSection = (s: SearchSectionHitDto) => {
    closeSearch();
    navigate(`/projects/${s.projectId}/list`);
  };

  const pickTag = () => {
    closeSearch();
    navigate('/projects');
  };

  const pickAt = (i: number) => {
    const row = pickables[i];
    if (!row) return;
    switch (row.type) {
      case 'task':
        pickTask(row.task);
        break;
      case 'project':
        pickProject(row.project);
        break;
      case 'section':
        pickSection(row.section);
        break;
      case 'tag':
        pickTag();
        break;
    }
  };

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const n = pickables.length;
    if (n === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = Math.min(Math.max(0, selectedIndex), n - 1);
      pickAt(idx);
    }
  }

  const sections = data?.sections ?? [];
  const tags = data?.tags ?? [];

  const hasResults =
    data &&
    (data.tasks.length > 0 ||
      data.projects.length > 0 ||
      sections.length > 0 ||
      tags.length > 0);
  const showHint = debounced.trim().length >= 2;

  const rowClass = (pickIndex: number) =>
    clsx(
      'w-full flex items-start gap-3 px-4 py-2.5 text-left text-sm',
      'hover:bg-brand-50/80 transition-colors',
      pickIndex === selectedIndex && 'bg-brand-50 ring-1 ring-brand-200/60',
    );

  const matchLabel = (t: SearchTaskHitDto) => {
    if (t.matchKind === 'COMMENT') return 'Comment match';
    if (t.matchKind === 'DESCRIPTION') return 'Description match';
    return null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close search"
        onClick={closeSearch}
      />
      <div
        className="relative w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[min(72vh,560px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <Search className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            id="global-search-title"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search tasks, projects, sections, tags…"
            className="flex-1 min-w-0 py-2 px-1 text-sm outline-none placeholder:text-gray-400"
            autoComplete="off"
          />
          {isFetching && (
            <span className="text-xs text-gray-400 shrink-0 pr-1">Searching…</span>
          )}
          <button
            type="button"
            onClick={closeSearch}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentWorkspace && (
          <p className="text-[11px] text-gray-500 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
            Scoped to workspace <span className="font-medium">{currentWorkspace.name}</span>
          </p>
        )}

        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
          {input.trim().length > 0 && input.trim().length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Type at least 2 characters</p>
          )}

          {showHint && isError && (
            <p className="px-4 py-6 text-center text-sm text-red-600">Search failed. Try again.</p>
          )}

          {showHint && !isFetching && !isError && data && !hasResults && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No matches</p>
          )}

          {data && data.tasks.length > 0 && (
            <div className="mb-2">
              <h3 className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Tasks
              </h3>
              <ul className="mt-0.5">
                {data.tasks.map((t) => {
                  const pi = indexByKey.get(`task:${t.id}`) ?? 0;
                  const hint = matchLabel(t);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        data-pick-index={pi}
                        onClick={() => pickTask(t)}
                        className={rowClass(pi)}
                      >
                        <CheckSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-900 truncate">
                            <HighlightMatch text={t.title} query={debounced} />
                          </span>
                          <span className="block text-xs text-gray-500 truncate">
                            {t.projectName ?? 'No project'}
                            {t.sectionName ? ` · ${t.sectionName}` : ''}
                            {t.status ? ` · ${t.status.replace(/_/g, ' ')}` : ''}
                            {hint ? ` · ${hint}` : ''}
                          </span>
                          {t.snippet ? (
                            <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2 italic">
                              {t.snippet}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {data && data.projects.length > 0 && (
            <div className="mb-2">
              <h3 className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Projects
              </h3>
              <ul className="mt-0.5">
                {data.projects.map((p) => {
                  const pi = indexByKey.get(`project:${p.id}`) ?? 0;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        data-pick-index={pi}
                        onClick={() => pickProject(p)}
                        className={rowClass(pi)}
                      >
                        <Folder className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-900 truncate">
                            <HighlightMatch text={p.name} query={debounced} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {data && sections.length > 0 && (
            <div className="mb-2">
              <h3 className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Sections
              </h3>
              <ul className="mt-0.5">
                {sections.map((s) => {
                  const pi = indexByKey.get(`section:${s.id}`) ?? 0;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        data-pick-index={pi}
                        onClick={() => pickSection(s)}
                        className={rowClass(pi)}
                      >
                        <LayoutList className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-900 truncate">
                            <HighlightMatch text={s.name} query={debounced} />
                          </span>
                          <span className="block text-xs text-gray-500 truncate">{s.projectName}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {data && tags.length > 0 && (
            <div>
              <h3 className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Tags
              </h3>
              <ul className="mt-0.5">
                {tags.map((g) => {
                  const pi = indexByKey.get(`tag:${g.id}`) ?? 0;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        data-pick-index={pi}
                        onClick={() => pickTag()}
                        className={rowClass(pi)}
                      >
                        <Tag
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: g.color || '#6B7280' }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-900 truncate">
                            <HighlightMatch text={g.name} query={debounced} />
                          </span>
                          <span className="block text-xs text-gray-500 truncate">Open projects</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px]">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px] ml-0.5">↓</kbd>{' '}
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px] ml-1">Enter</kbd>{' '}
            to choose ·{' '}
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px]">Esc</kbd> close
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px]">⌘</kbd>
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px] ml-0.5">K</kbd> /{' '}
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px]">Ctrl</kbd>
            <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[10px] ml-0.5">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
