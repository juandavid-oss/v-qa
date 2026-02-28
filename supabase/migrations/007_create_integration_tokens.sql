CREATE TABLE integration_tokens (
  provider TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: clients must not access this table.
-- Service-role operations from backend bypass RLS safely.

