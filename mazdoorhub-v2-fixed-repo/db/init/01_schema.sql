CREATE TABLE IF NOT EXISTS users(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('employer','worker','admin')),
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS identities(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT,
  provider_uid TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workers(
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  availability BOOLEAN DEFAULT false,
  kyc_status TEXT DEFAULT 'pending',
  reliability_score NUMERIC(3,2) DEFAULT 3.0
);
CREATE TABLE IF NOT EXISTS skills(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT
);
CREATE TABLE IF NOT EXISTS worker_skills(
  worker_id UUID REFERENCES workers(user_id) ON DELETE CASCADE,
  skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
  verified_by_admin BOOLEAN DEFAULT false,
  badge TEXT,
  PRIMARY KEY(worker_id, skill_id)
);
CREATE TABLE IF NOT EXISTS devices(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT,
  platform TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  skill_id INT REFERENCES skills(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  budget_type TEXT,
  budget_amount INT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'posted',
  accepted_worker_id UUID,
  broadcast_attempts INT NOT NULL DEFAULT 0,
  surge_multiplier NUMERIC(4,2) DEFAULT 1.00,
  guarantee_min_pkr INT DEFAULT 0,
  material_amount INT DEFAULT 0,
  arrival_eta_min INT,
  scheduled_start_ts TIMESTAMP NULL,
  scheduled_end_ts TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS escrows(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES users(id) ON DELETE SET NULL,
  hold_amount INT DEFAULT 0,
  material_hold_amount INT DEFAULT 0,
  status TEXT DEFAULT 'held',
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ratings(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ratee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INT CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS worker_preferences (
  worker_id UUID PRIMARY KEY REFERENCES workers(user_id) ON DELETE CASCADE,
  preferred_radius_km INT DEFAULT 8,
  min_fixed_pkr INT DEFAULT 0,
  accept_under_min BOOLEAN DEFAULT false,
  category_priorities JSONB DEFAULT '{}'::jsonb,
  last_auto_off_ts TIMESTAMP
);
CREATE TABLE IF NOT EXISTS worker_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(user_id) ON DELETE CASCADE,
  start_ts TIMESTAMP NOT NULL,
  end_ts TIMESTAMP NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_worker_blocks_range ON worker_blocks(worker_id, start_ts, end_ts);
CREATE TABLE IF NOT EXISTS job_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('worker','employer')),
  key TEXT NOT NULL,
  kind TEXT DEFAULT 'photo',
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('escrow_hold','escrow_capture','escrow_release','topup_guarantee','tip','fee','incentive','adjustment','topup')),
  amount INT NOT NULL,
  currency TEXT DEFAULT 'PKR',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledgers_user ON ledgers(user_id, created_at);
CREATE TABLE IF NOT EXISTS worker_employer_stats (
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  completed_jobs INT DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  last_job_ts TIMESTAMP,
  PRIMARY KEY(worker_id, employer_id)
);
