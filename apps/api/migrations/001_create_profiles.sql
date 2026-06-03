CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('PENDING_CONFIG', 'PENDING_LOGIN', 'READY', 'BUSY')),
  version integer NOT NULL CHECK (version > 0),
  pillars jsonb NOT NULL,
  provisioning_token_hash text,
  provisioning_token_expires_at timestamptz,
  next_available_window_at timestamptz,
  daily_safety_metrics jsonb NOT NULL,
  active_lease jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_token_hash
  ON profiles (provisioning_token_hash)
  WHERE provisioning_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_next_available_window_at
  ON profiles (next_available_window_at);
CREATE INDEX IF NOT EXISTS idx_profiles_checkout
  ON profiles (status, next_available_window_at);
