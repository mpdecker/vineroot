import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SettingsLayout from './SettingsLayout';

describe('SettingsLayout', () => {
  it('renders nav links and outlet', () => {
    render(
      <MemoryRouter initialEntries={['/settings/profile']}>
        <Routes>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="profile" element={<div>Profile content</div>} />
            <Route path="workspace" element={<div>Workspace content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/settings/profile');
    expect(screen.getByRole('link', { name: /workspace/i })).toHaveAttribute('href', '/settings/workspace');
    expect(screen.getByText('Profile content')).toBeInTheDocument();
  });
});
