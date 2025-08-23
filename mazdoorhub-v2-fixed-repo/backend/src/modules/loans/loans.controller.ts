import { Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Controller('v1/loans')
export class LoansController {
  constructor(private ds: DataSource) {}
  @Get('offers') offers(@Query('worker_id') workerId: string, @Query('avg_monthly') avgMonthly: string = '50000'){ const m = Number(avgMonthly || '50000'); const tier = m > 80000 ? 'A' : m > 40000 ? 'B' : 'C'; const offers = [ { partner: 'MicroFin A', tier, amount: Math.round(m*0.8), rate_apr: 0.24, tenure_months: 6 }, { partner: 'ToolBank', tier, amount: Math.round(m*0.5), rate_apr: 0.18, tenure_months: 9 } ]; return { worker_id: workerId, offers }; }
  @Get('export') async exportPerf(@Query('worker_id') workerId: string){ const earnings = await this.ds.query(`SELECT COALESCE(SUM(CASE WHEN type='escrow_capture' THEN amount ELSE 0 END),0) as captured, COUNT(DISTINCT job_id) as jobs FROM ledgers WHERE user_id=$1`, [workerId]); const m = earnings[0] || { captured: 0, jobs: 0 }; return { worker_id: workerId, anon_metrics: { total_jobs: Number(m.jobs||0), total_captured_pkr: Number(m.captured||0), avg_per_job_pkr: Number(m.jobs||0) ? Math.round(Number(m.captured||0)/Number(m.jobs||0)) : 0 } }; }
}
