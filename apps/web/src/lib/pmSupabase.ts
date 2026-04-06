import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getPmSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url?.trim() || !key?.trim()) {
    return null;
  }
  if (!client) {
    client = createClient(url, key);
  }
  return client;
}

export type PmProjectRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  idea_brief_path: string | null;
  plan_path: string | null;
  design_doc_path: string | null;
  repo_url: string | null;
  metadata: Record<string, unknown>;
};

export type PmTaskRow = {
  id: string;
  project_id: string;
  phase: number;
  implementation_phase: string | null;
  title: string;
  description: string;
  actor_tier: string;
  domain: string;
  complexity: string;
  estimated_minutes: number;
  timeout_minutes: number;
  parallel_group: string | null;
  status: string;
  priority: number;
  review_gate: string;
  acceptance_criteria: unknown;
  context_refs: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PmHumanGateRow = {
  id: string;
  project_id: string;
  gate_type: string;
  originating_task_id: string | null;
  blocking_task_id: string | null;
  context_summary: string;
  failure_history: unknown;
  decision_options: unknown;
  recommended_option: string | null;
  decision: string | null;
  decision_notes: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  age_alert_sent: boolean;
};

export type PmAuditRow = {
  id: string;
  project_id: string | null;
  task_id: string | null;
  gate_id: string | null;
  event_type: string;
  actor: string | null;
  from_value: string | null;
  to_value: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};
