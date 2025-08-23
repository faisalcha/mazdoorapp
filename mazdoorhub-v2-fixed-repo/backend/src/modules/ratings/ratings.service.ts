import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { DataSource } from 'typeorm';
@Injectable()
export class RatingsService {
  constructor(@InjectRepository(Rating) private repo: Repository<Rating>, private ds: DataSource) {}
  async create(data: Partial<Rating>) {
    if (!data.score || data.score < 1 || data.score > 5) throw new Error('Score must be 1-5');
    const saved = await this.repo.save(this.repo.create(data));
    const job = await this.ds.query('SELECT employer_id, accepted_worker_id FROM jobs WHERE id=$1', [data.job_id]);
    if (job[0] && data.rater_id === job[0].employer_id && data.ratee_id === job[0].accepted_worker_id) {
      await this.ds.query(`
        INSERT INTO worker_employer_stats (worker_id, employer_id, completed_jobs, avg_rating, last_job_ts)
        VALUES ($1,$2,1,$3,now())
        ON CONFLICT (worker_id, employer_id) DO UPDATE SET
          completed_jobs = worker_employer_stats.completed_jobs + 1,
          avg_rating = ((worker_employer_stats.avg_rating * GREATEST(worker_employer_stats.completed_jobs,0)) + $3) / (worker_employer_stats.completed_jobs + 1),
          last_job_ts = now()
      `, [data.ratee_id, data.rater_id, data.score]);
    }
    return saved;
  }
  byJob(jobId: string) { return this.repo.find({ where: { job_id: jobId } }); }
}
