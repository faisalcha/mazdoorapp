import { Controller, Post, Body } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('v1/devices')
export class DevicesController {
  constructor(private ds: DataSource) {}

  @Post('heartbeat')
  async heartbeat(
    @Body() b: { user_id: string; token?: string; platform?: string },
  ) {
    await this.ds.query(
      `INSERT INTO devices (user_id, token, platform) VALUES ($1,$2,$3) ON CONFLICT (user_id, token) DO UPDATE SET platform=EXCLUDED.platform, created_at=now()`,
      [b.user_id, b.token || null, b.platform || null],
    );
    return { ok: true };
  }
}

