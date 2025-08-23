import { Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
function rangeToSql(range?: string) {
  if (!range) return '';
  if (range === 'today') return "AND created_at::date = CURRENT_DATE";
  if (range === 'week') return "AND created_at >= date_trunc('week', now())";
  if (range === 'month') return "AND created_at >= date_trunc('month', now())";
  return '';
}
@Controller('v1/earnings')
export class EarningsController {
  constructor(private ds: DataSource) {}
  @Get('summary') async summary(@Query('user_id') userId: string, @Query('range') range?: string){
    const clause = rangeToSql(range);
    const rows = await this.ds.query(`SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credits, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) as debits FROM ledgers WHERE user_id = $1 ${clause}`, [userId]);
    const { credits, debits } = rows[0] || { credits: 0, debits: 0 };
    return { user_id: userId, range: range || 'all', credits: Number(credits||0), debits: Number(debits||0), net: Number(credits||0) - Number(debits||0) };
  }
  @Get('history') async history(@Query('user_id') userId: string, @Query('limit') limit = '50', @Query('range') range?: string){
    const clause = rangeToSql(range);
    return this.ds.query(`SELECT id, job_id, type, amount, currency, meta, created_at FROM ledgers WHERE user_id = $1 ${clause} ORDER BY created_at DESC LIMIT $2`, [userId, Number(limit)]);
  }
}
