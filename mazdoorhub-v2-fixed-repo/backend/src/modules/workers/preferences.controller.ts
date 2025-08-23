import { Controller, Patch, Body, Param, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Controller('v1/workers')
export class PreferencesController {
  constructor(private ds: DataSource) {}
  @Patch(':id/preferences') async setPrefs(@Param('id') id: string, @Body() body: any){
    const def = { preferred_radius_km: 8, min_fixed_pkr: 0, accept_under_min: false, category_priorities: {} };
    const q = `INSERT INTO worker_preferences (worker_id, preferred_radius_km, min_fixed_pkr, accept_under_min, category_priorities)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (worker_id) DO UPDATE SET
                 preferred_radius_km=EXCLUDED.preferred_radius_km,
                 min_fixed_pkr=EXCLUDED.min_fixed_pkr,
                 accept_under_min=EXCLUDED.accept_under_min,
                 category_priorities=EXCLUDED.category_priorities
               RETURNING *`;
    const r = await this.ds.query(q, [id, body.preferred_radius_km ?? def.preferred_radius_km, body.min_fixed_pkr ?? def.min_fixed_pkr, !!body.accept_under_min, body.category_priorities ?? def.category_priorities]);
    return r[0];
  }
  @Post(':id/blocks') async addBlock(@Param('id') id: string, @Body() body: { start_ts: string; end_ts: string; note?: string }){
    const q = `INSERT INTO worker_blocks (worker_id, start_ts, end_ts, note) VALUES ($1,$2,$3,$4) RETURNING *`;
    const r = await this.ds.query(q, [id, body.start_ts, body.end_ts, body.note || null]);
    return r[0];
  }
}
