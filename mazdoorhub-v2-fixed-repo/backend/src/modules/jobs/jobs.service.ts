import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrsService } from '../../integrations/ors.service';
import { PushService } from '../../integrations/push.service';

@Injectable()
export class JobsService {
  constructor(private data: DataSource, private ors: OrsService, private push: PushService) {}

  async create(body: any) {
    const q = `INSERT INTO jobs (employer_id, skill_id, title, description, budget_type, budget_amount, lat, lon, status, guarantee_min_pkr, material_amount, scheduled_start_ts, scheduled_end_ts)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'posted',$9,$10,$11,$12) RETURNING *`;
    const r = await this.data.query(q, [
      body.employer_id, body.skill_id, body.title || null, body.description || null,
      body.budget_type || 'fixed', body.budget_amount || 0,
      body.lat, body.lon, body.guarantee_min_pkr || 0, body.material_amount || 0,
      body.scheduled_start_ts || null, body.scheduled_end_ts || null
    ]);
    const job = r[0];
    await this.applySurge(job.id, job.lon, job.lat);
    await this.shortlistAndNotify(job, job.skill_id, job.employer_id, 12, 8);
    return job;
  }

  async applySurge(jobId: string, lon: number, lat: number) {
    const counts = await this.data.query(`
      WITH near_jobs AS (
        SELECT 1 FROM jobs j WHERE j.status='posted' AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(j.lon,j.lat),4326)::geography,
          ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, 8000)
      ), near_workers AS (
        SELECT 1 FROM workers w WHERE w.availability=true AND w.lat IS NOT NULL AND w.lon IS NOT NULL AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(w.lon,w.lat),4326)::geography,
          ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, 8000)
      )
      SELECT (SELECT COUNT(*) FROM near_jobs) as demand, (SELECT COUNT(*) FROM near_workers) as supply;
    `, [lon, lat]);
    const demand = Number(counts?.[0]?.demand || 0);
    const supply = Math.max(1, Number(counts?.[0]?.supply || 1));
    const surge = Math.min(2.0, 1.0 + Math.max(0, (demand - supply)) * 0.1);
    await this.data.query('UPDATE jobs SET surge_multiplier=$2 WHERE id=$1', [jobId, surge]);
  }

  async shortlistAndNotify(job: any, skill_id: number, employer_id: string, topK = 10, radiusKm = 8) {
    const now = new Date();
    const startTs = job.scheduled_start_ts || now.toISOString();
    const endTs = job.scheduled_end_ts || new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

    const sql = `
      WITH job_cat AS (SELECT category FROM skills WHERE id=$1)
      SELECT w.user_id, w.lat, w.lon, w.reliability_score,
             COALESCE(wp.preferred_radius_km, $6) as pref_radius,
             COALESCE(wp.min_fixed_pkr, 0) as min_fixed_pkr,
             COALESCE( (wp.category_priorities ->> (SELECT category FROM job_cat))::int, 0) as cat_priority,
             COALESCE(wes.avg_rating, 0) as affinity_avg
      FROM workers w
      JOIN worker_skills ws ON ws.worker_id = w.user_id AND ws.skill_id = $1
      LEFT JOIN worker_preferences wp ON wp.worker_id = w.user_id
      LEFT JOIN worker_employer_stats wes ON wes.worker_id = w.user_id AND wes.employer_id = $2
      WHERE w.availability = true
        AND w.kyc_status = 'verified'
        AND w.lat IS NOT NULL AND w.lon IS NOT NULL
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(w.lon, w.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
            COALESCE(wp.preferred_radius_km, $6) * 1000
        )
        AND ($5 = 0 OR $5 >= COALESCE(wp.min_fixed_pkr,0))
        AND NOT EXISTS (
          SELECT 1 FROM worker_blocks b
           WHERE b.worker_id = w.user_id
             AND tstzrange(b.start_ts, b.end_ts, '[)') && tstzrange($7::timestamp, $8::timestamp, '[)')
        )
      ORDER BY (CASE WHEN COALESCE(wes.avg_rating,0) >= 4.0 THEN 1 ELSE 0 END) DESC,
               cat_priority DESC,
               ST_DistanceSphere(ST_MakePoint(w.lon, w.lat), ST_MakePoint($3, $4)),
               w.reliability_score DESC
      LIMIT $9
    `;
    const rows = await this.data.query(sql, [
      skill_id, employer_id, job.lon, job.lat, job.budget_amount || 0,
      radiusKm, startTs, endTs, topK
    ]);

    for (const r of rows) {
      const etaMin = await this.ors.eta(r.lat, r.lon, job.lat, job.lon);
      await this.push.notifyUser(r.user_id, {
        title: `Nearby ${job.title || 'job'}`,
        body: `ETA ${etaMin} min`,
        data: { type: 'job_offer', job_id: job.id, skill_id: job.skill_id, eta_min: String(etaMin) }
      });
    }
  }

  async accept(id: string, worker_id: string, employer_id: string, amount: number) {
    const jb = await this.data.query('SELECT budget_amount, surge_multiplier, material_amount FROM jobs WHERE id=$1', [id]);
    const job = jb[0];
    const labor = Number(job?.budget_amount || 0);
    const material = Number(job?.material_amount || 0);
    const holdTotal = Number(amount || labor + material);

    const up = await this.data.query('UPDATE jobs SET status=$2, accepted_worker_id=$3 WHERE id=$1 RETURNING *', [id, 'accepted', worker_id]);
    await this.data.query('INSERT INTO escrows (job_id, employer_id, worker_id, hold_amount, material_hold_amount, status) VALUES ($1,$2,$3,$4,$5,\'held\')', [id, employer_id, worker_id, holdTotal - material, material]);
    await this.data.query('INSERT INTO ledgers (user_id, job_id, type, amount, meta) VALUES ($1,$2,\'escrow_hold\',$3,$4)', [employer_id, id, -(holdTotal), JSON.stringify({note:'employer hold', labor, material})]);
    return up[0];
  }

  async start(id: string) {
    const job = await this.data.query('UPDATE jobs SET status=$2 WHERE id=$1 RETURNING *', [id, 'in_progress']); 
    return job[0];
  }

  async complete(id: string) {
    const jb = await this.data.query('SELECT employer_id, accepted_worker_id as worker_id, budget_amount, surge_multiplier, guarantee_min_pkr, material_amount FROM jobs WHERE id=$1', [id]);
    const job = jb[0];
    const worker = job.worker_id;
    const employer = job.employer_id;
    const base = Number(job.budget_amount || 0);
    const surge = Number(job.surge_multiplier || 1.0);
    const gross = Math.floor(base * surge);
    const fee = Math.floor(gross * 0.10);
    const net = gross - fee;

    const jobRow = await this.data.query('UPDATE jobs SET status=$2, completed_at=now() WHERE id=$1 RETURNING *', [id, 'completed']);
    await this.data.query('UPDATE escrows SET status=$2 WHERE job_id=$1', [id, 'captured']);
    await this.data.query('INSERT INTO ledgers (user_id, job_id, type, amount, meta) VALUES ($1,$2,\'escrow_capture\',$3,$4)', [worker, id, net, JSON.stringify({gross, fee, surge})]);
    await this.data.query('INSERT INTO ledgers (user_id, job_id, type, amount, meta) VALUES ($1,$2,\'fee\',$3,$4)', [worker, id, -fee, JSON.stringify({rate:0.10, base:gross})]);
    await this.data.query('INSERT INTO ledgers (user_id, job_id, type, amount, meta) VALUES ($1,$2,\'escrow_release\',$3,$4)', [employer, id, 0, JSON.stringify({note:'release after capture'})]);
    return jobRow[0];
  }
}
