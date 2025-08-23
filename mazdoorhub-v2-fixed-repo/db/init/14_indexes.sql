CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_workers_availability ON workers(availability);
CREATE INDEX IF NOT EXISTS idx_jobs_lon_lat ON jobs(lon, lat);
CREATE INDEX IF NOT EXISTS idx_workers_lon_lat ON workers(lon, lat);
CREATE INDEX IF NOT EXISTS idx_ledgers_user_created ON ledgers(user_id, created_at);
