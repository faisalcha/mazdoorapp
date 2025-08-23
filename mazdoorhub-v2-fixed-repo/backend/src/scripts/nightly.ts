import 'reflect-metadata'; import * as dotenv from 'dotenv'; dotenv.config();
import { DataSource } from 'typeorm';
(async () => {
  const ds = new DataSource({ type:'postgres', host:process.env.POSTGRES_HOST, port:Number(process.env.POSTGRES_PORT||5432), username:process.env.POSTGRES_USER, password:process.env.POSTGRES_PASSWORD, database:process.env.POSTGRES_DB });
  await ds.initialize();
  await ds.query(`
    INSERT INTO ledgers (user_id, job_id, type, amount, meta)
    SELECT j.accepted_worker_id, e.job_id, 'topup_guarantee', (j.guarantee_min_pkr - (SELECT COALESCE(SUM(amount),0) FROM ledgers WHERE user_id=j.accepted_worker_id AND job_id=j.id AND type IN ('escrow_capture','tip'))),
           jsonb_build_object('reason','guarantee_min','required', j.guarantee_min_pkr)
    FROM jobs j
    JOIN escrows e ON e.job_id = j.id
    WHERE j.status='completed' AND j.guarantee_min_pkr > 0
      AND (SELECT COALESCE(SUM(amount),0) FROM ledgers WHERE user_id=j.accepted_worker_id AND job_id=j.id AND type IN ('escrow_capture','tip')) < j.guarantee_min_pkr
      AND NOT EXISTS (SELECT 1 FROM ledgers l WHERE l.user_id=j.accepted_worker_id AND l.job_id=j.id AND l.type='topup_guarantee')
  `);
  await ds.query(`
    WITH r as (SELECT ratee_id as worker_id, AVG(score) as avg_score FROM ratings GROUP BY ratee_id)
    UPDATE workers w SET reliability_score = LEAST(5.00, COALESCE(r.avg_score, 3.0))
    FROM r WHERE w.user_id = r.worker_id
  `);
  await ds.query(`
    WITH today_completed AS (
      SELECT accepted_worker_id AS worker_id, COUNT(*) AS c
      FROM jobs WHERE status='completed' AND completed_at::date = CURRENT_DATE
      GROUP BY accepted_worker_id
    )
    INSERT INTO streaks(worker_id, streak_days, last_completed_date)
    SELECT worker_id, 1, CURRENT_DATE FROM today_completed
    ON CONFLICT (worker_id) DO UPDATE SET
      streak_days = CASE WHEN streaks.last_completed_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.streak_days + 1 ELSE GREATEST(streaks.streak_days,1) END,
      last_completed_date = CURRENT_DATE
  `);
  await ds.destroy();
  console.log('Nightly done.');
})().catch(e=>{ console.error(e); process.exit(1)});
