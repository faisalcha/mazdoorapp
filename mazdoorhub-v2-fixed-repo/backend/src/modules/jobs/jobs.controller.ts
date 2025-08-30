import { Controller, Post, Body, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { DataSource } from 'typeorm';
import { RedisService } from '../../integrations/redis.service';
import { PushService } from '../../integrations/push.service';

@Controller('v1/jobs')
export class JobsController {
  constructor(
    private jobs: JobsService,
    private ds: DataSource,
    private push: PushService,
    private redis: RedisService,
  ) {}

  @Post() async create(@Body() body: any) { return this.jobs.create(body); }

  @Post(':id/accept') async accept(@Param('id') id: string, @Body() b: { worker_id: string; employer_id: string; amount: number }) {
    return this.jobs.accept(id, b.worker_id, b.employer_id, b.amount);
  }

  @Post(':id/start') async start(@Param('id') id: string) { return this.jobs.start(id); }

  @Post(':id/complete') async complete(@Param('id') id: string) { return this.jobs.complete(id); }

  @Post(':id/tracker') async tracker(@Param('id') id: string) {
    const q = `SELECT j.status, j.accepted_worker_id, j.employer_id, w.lat, w.lon
               FROM jobs j LEFT JOIN workers w ON w.user_id = j.accepted_worker_id
               WHERE j.id = $1`;
    const rows = await this.ds.query(q, [id]);
    const r = rows[0];
    if (!r) throw new Error('Job not found');
    return { status: r.status, worker: r.accepted_worker_id ? { id: r.accepted_worker_id, lat: r.lat, lon: r.lon } : null };
  }

  @Post(':id/eta') async eta(@Param('id') id: string, @Body() body: { worker_id: string; eta_min: number }) {
    await this.ds.query('UPDATE jobs SET arrival_eta_min=$2 WHERE id=$1', [id, body.eta_min]);
    const r = await this.ds.query('SELECT employer_id FROM jobs WHERE id=$1', [id]);
    const employerId = r?.[0]?.employer_id;
    if (employerId) {
      await this.push.notifyUser(employerId, { title: 'Worker on the way', body: `ETA ${body.eta_min} min`, data: { type:'eta_update', job_id:id } });
    }
    return { ok: true };
  }

  @Post(':id/peek') async peek(@Param('id') id: string, @Body() body: { worker_id: string }) {
    const ok = await this.redis.softLockJob(id, body.worker_id, 90000);
    const heldBy = ok ? body.worker_id : await this.redis.softLockInfo(id);
    return { soft_hold: ok, held_by: heldBy };
  }
}
