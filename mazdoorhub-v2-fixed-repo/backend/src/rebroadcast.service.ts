import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm'; import { JobsService } from './modules/jobs/jobs.service';
@Injectable()
export class RebroadcastService implements OnModuleInit {
  constructor(private ds: DataSource, private jobs: JobsService) {}
  onModuleInit() { setInterval(() => this.tick().catch(e => console.warn('rebroadcast error', e?.message || e)), 60 * 1000); }
  private async tick() {
    const rows = await this.ds.query(`
      SELECT id, skill_id, lat, lon, broadcast_attempts, EXTRACT(EPOCH FROM (now() - created_at))/60 as age_min
      FROM jobs WHERE status='posted' ORDER BY created_at ASC LIMIT 50
    `);
    for (const j of rows) {
      const attempt = Number(j.broadcast_attempts || 0);
      const thresholds = [10, 20, 35];
      const radii = [8, 12, 18, 25];
      const neededAttempt = thresholds.findIndex((t:number) => j.age_min >= t) + 1;
      if (neededAttempt > attempt) {
        const radius = radii[Math.min(neededAttempt, radii.length - 1)];
        await this.jobs.shortlistAndNotify({ id: j.id, lat: j.lat, lon: j.lon, budget_amount: 0 }, j.skill_id, null as any, 15, radius);
        await this.ds.query(`UPDATE jobs SET broadcast_attempts=$2 WHERE id=$1`, [j.id, neededAttempt]);
      }
    }
  }
}
