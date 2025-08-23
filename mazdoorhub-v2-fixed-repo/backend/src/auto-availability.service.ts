import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class AutoAvailabilityService implements OnModuleInit {
  constructor(private ds: DataSource) {}
  onModuleInit() { setInterval(()=> this.tick().catch(()=>{}), 60*1000); }
  private async tick() {
    await this.ds.query(`
      UPDATE workers SET availability=false
      WHERE availability=true AND (now() - COALESCE((SELECT MAX(created_at) FROM devices WHERE user_id=workers.user_id), now())) > interval '120 minutes'
    `);
  }
}
