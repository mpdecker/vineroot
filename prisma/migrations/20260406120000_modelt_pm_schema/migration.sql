-- ModelT PM schema (Section 5.2) + RLS for Supabase anon/authenticated

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── projects ───────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PHASE_0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idea_brief_path TEXT,
  plan_path TEXT,
  design_doc_path TEXT,
  repo_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─── tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL CHECK (phase BETWEEN 0 AND 8),
  implementation_phase TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_tier TEXT NOT NULL,
  domain TEXT NOT NULL,
  complexity TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 60,
  timeout_minutes INTEGER NOT NULL DEFAULT 60,
  parallel_group TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  review_gate TEXT NOT NULL DEFAULT 'AUTOMATED_ONLY',
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_status_check CHECK (status IN (
    'PENDING', 'READY', 'CONTEXT_ASSEMBLY', 'DISPATCHED',
    'DISPATCH_PENDING', 'IN_PROGRESS', 'BLOCKED_AWAITING_HUMAN',
    'FAILED', 'OUTPUT_RECEIVED', 'VALIDATING', 'REVISION_REQUIRED',
    'REVIEW_PENDING', 'APPROVED', 'DONE', 'ESCALATION_PENDING',
    'BLOCKED_METADATA_ERROR', 'BLOCKED_DEPENDENCY_CANCELLED',
    'BLOCKED_HUMAN_REROUTE', 'REROUTED_READY',
    'DEFERRED', 'CANCELLED'
  ))
);

CREATE INDEX tasks_project_status ON tasks(project_id, status);
CREATE INDEX tasks_actor_tier ON tasks(actor_tier);
CREATE INDEX tasks_phase ON tasks(project_id, phase);

-- ─── task_dependencies ─────────────────────────────────────────────────────
CREATE TABLE task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);

CREATE INDEX task_deps_on ON task_dependencies(depends_on_id);

-- ─── task_artifacts ─────────────────────────────────────────────────────────
CREATE TABLE task_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  url TEXT,
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX artifacts_task ON task_artifacts(task_id);

-- ─── task_runs ──────────────────────────────────────────────────────────────
CREATE TABLE task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  run_number INTEGER NOT NULL,
  actor_tier TEXT NOT NULL,
  actor_detail TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  failure_reason TEXT,
  output_summary TEXT,
  artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX runs_task ON task_runs(task_id, run_number);

-- ─── human_gates ───────────────────────────────────────────────────────────
CREATE TABLE human_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL,
  originating_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  blocking_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  context_summary TEXT NOT NULL,
  failure_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_options JSONB NOT NULL,
  recommended_option TEXT,
  decision TEXT,
  decision_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  age_alert_sent BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX gates_project_status ON human_gates(project_id, status);

-- ─── audit_log (ModelT PM — distinct from "AuditLog" product table) ─────────
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  gate_id UUID REFERENCES human_gates(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  from_value TEXT,
  to_value TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_project ON audit_log(project_id, created_at DESC);
CREATE INDEX audit_task ON audit_log(task_id, created_at DESC);

-- ─── rag_ingestion_log ─────────────────────────────────────────────────────
CREATE TABLE rag_ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  chunk_count INTEGER,
  collection TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT
);

CREATE INDEX rag_project ON rag_ingestion_log(project_id);

-- ─── Triggers: updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at();

-- ─── get_ready_tasks ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_ready_tasks(p_project_id UUID)
RETURNS SETOF tasks AS $$
  SELECT t.* FROM tasks t
  WHERE t.project_id = p_project_id
    AND t.status = 'PENDING'
    AND NOT EXISTS (
      SELECT 1 FROM task_dependencies td
      JOIN tasks dep ON dep.id = td.depends_on_id
      WHERE td.task_id = t.id
        AND dep.status != 'DONE'
    );
$$ LANGUAGE sql STABLE;

-- ─── has_circular_dependency ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_circular_dependency(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  cycle_found BOOLEAN := false;
BEGIN
  WITH RECURSIVE dep_chain AS (
    SELECT td.task_id, td.depends_on_id, ARRAY[td.task_id]::text[] AS path, false AS cycle
    FROM task_dependencies td
    JOIN tasks t ON t.id = td.task_id
    WHERE t.project_id = p_project_id
    UNION ALL
    SELECT dc.task_id, td.depends_on_id,
           dc.path || td.task_id,
           td.task_id = ANY(dc.path)
    FROM dep_chain dc
    JOIN task_dependencies td ON td.task_id = dc.depends_on_id
    WHERE NOT dc.cycle
  )
  SELECT EXISTS (SELECT 1 FROM dep_chain WHERE cycle) INTO cycle_found;
  RETURN cycle_found;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Row level security ─────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_ingestion_log ENABLE ROW LEVEL SECURITY;

-- Read dashboards / boards
CREATE POLICY pm_projects_select ON projects FOR SELECT USING (true);
CREATE POLICY pm_tasks_select ON tasks FOR SELECT USING (true);
CREATE POLICY pm_task_deps_select ON task_dependencies FOR SELECT USING (true);
CREATE POLICY pm_task_artifacts_select ON task_artifacts FOR SELECT USING (true);
CREATE POLICY pm_task_runs_select ON task_runs FOR SELECT USING (true);
CREATE POLICY pm_human_gates_select ON human_gates FOR SELECT USING (true);
CREATE POLICY pm_audit_log_select ON audit_log FOR SELECT USING (true);
CREATE POLICY pm_rag_log_select ON rag_ingestion_log FOR SELECT USING (true);

-- Human operator overrides (Section 5.2 RLS intent)
CREATE POLICY pm_tasks_update_human ON tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY pm_human_gates_update ON human_gates FOR UPDATE USING (true) WITH CHECK (true);

-- Grants for Supabase PostgREST roles (skip if roles missing, e.g. plain local Postgres)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT SELECT ON projects, tasks, task_dependencies, task_artifacts, task_runs, human_gates, audit_log, rag_ingestion_log TO anon, authenticated;
    GRANT UPDATE ON tasks, human_gates TO anon, authenticated;
  END IF;
END $$;
