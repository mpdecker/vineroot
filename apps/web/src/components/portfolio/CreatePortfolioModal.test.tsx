import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CreatePortfolioModal } from './CreatePortfolioModal';

const mockCreate = vi.fn();
const mockReset = vi.fn();

vi.mock('../../hooks/usePortfolios', () => ({
  useCreatePortfolio: () => ({
    mutateAsync: mockCreate,
    isPending: false,
    error: null,
    reset: mockReset,
  }),
}));

function renderModal(
  isOpen = true,
  onClose = vi.fn(),
  workspaceId = 'ws-1',
  onCreated?: (id: string) => void,
) {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <CreatePortfolioModal
      isOpen={isOpen}
      onClose={onClose}
      workspaceId={workspaceId}
      onCreated={onCreated}
    />,
    { wrapper: Wrapper },
  );
}

describe('CreatePortfolioModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render dialog when closed', () => {
    renderModal(false);
    expect(screen.queryByRole('heading', { name: /create portfolio/i })).not.toBeInTheDocument();
  });

  it('creates portfolio and calls onCreated with id', async () => {
    mockCreate.mockResolvedValue({ id: 'pf-new', workspaceId: 'ws-1' });
    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderModal(true, onClose, 'ws-1', onCreated);

    await userEvent.type(screen.getByPlaceholderText(/q1 initiatives/i), 'Q1');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        name: 'Q1',
        description: undefined,
      });
    });
    expect(onClose).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith('pf-new');
  });

  it('submit is disabled without name', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
  });
});
