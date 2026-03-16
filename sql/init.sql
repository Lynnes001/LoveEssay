CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  school_name TEXT NOT NULL,
  query TEXT NOT NULL,
  notes TEXT,
  material_file_name TEXT NOT NULL,
  material_file_path TEXT NOT NULL,
  material_mime_type TEXT,
  material_file_size BIGINT,
  request_ip TEXT,
  workflow_version TEXT NOT NULL,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  current_step TEXT,
  error_message TEXT,
  result_text TEXT,
  profile_json JSONB,
  sections_json JSONB,
  metrics_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);

CREATE TABLE IF NOT EXISTS task_events (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events (task_id, created_at);
