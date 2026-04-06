import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateGoalModal } from './CreateGoalModal';

describe('CreateGoalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(
      <CreateGoalModal isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByRole('heading', { name: /new goal/i })).not.toBeInTheDocument();
  });

  it('submits name and optional description', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CreateGoalModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText(/q1 launch readiness/i), 'Release');
    await userEvent.type(screen.getByPlaceholderText(/optional details/i), 'Ship it');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Release',
      description: 'Ship it',
    });
  });

  it('does not submit empty name', async () => {
    const onSubmit = vi.fn();
    render(<CreateGoalModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes on cancel', async () => {
    const onClose = vi.fn();
    render(<CreateGoalModal isOpen onClose={onClose} onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
