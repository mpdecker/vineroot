import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PmProjectCreateModal } from './PmProjectCreateModal';

const insertMock = vi.fn();

const { getPmSupabaseMock } = vi.hoisted(() => ({
  getPmSupabaseMock: vi.fn(),
}));

vi.mock('../../../components/ui/Modal', () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}));

vi.mock('../../../lib/pmSupabase', () => ({
  getPmSupabase: () => getPmSupabaseMock(),
}));

describe('PmProjectCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReset();
    getPmSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: (row: unknown) => {
          insertMock(row);
          return Promise.resolve({ error: null });
        },
      })),
    } as never);
  });

  it('inserts project on submit', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(
      <PmProjectCreateModal open onClose={onClose} onCreated={onCreated} />,
    );

    await userEvent.type(screen.getByPlaceholderText('My app'), 'Cool App');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Cool App',
        status: 'PHASE_0',
      }),
    );
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error when Supabase returns error', async () => {
    getPmSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: () => Promise.resolve({ error: { message: 'duplicate' } }),
      })),
    } as never);

    render(
      <PmProjectCreateModal open onClose={vi.fn()} onCreated={vi.fn()} />,
    );
    await userEvent.type(screen.getByPlaceholderText('My app'), 'X');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(screen.getByText('duplicate')).toBeInTheDocument();
  });
});
