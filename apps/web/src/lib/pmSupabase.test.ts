import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getPmSupabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns null when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getPmSupabase } = await import('./pmSupabase');
    expect(getPmSupabase()).toBeNull();
  });

  it('returns a singleton client when URL and anon key are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const { getPmSupabase } = await import('./pmSupabase');
    const a = getPmSupabase();
    const b = getPmSupabase();
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('returns null when URL is whitespace only', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '   ');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');
    const { getPmSupabase } = await import('./pmSupabase');
    expect(getPmSupabase()).toBeNull();
  });
});
