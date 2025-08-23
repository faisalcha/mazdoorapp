import { Controller, Patch, Body, Param, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Controller('v1/workers')
export class WorkersController {
  constructor(private ds: DataSource) {}
  @Patch(':id/availability') async availability(@Param('id') id: string, @Body() body: { availability: boolean }){
    await this.ds.query('UPDATE workers SET availability=$2 WHERE user_id=$1', [id, !!body.availability]);
    return { ok: true };
  }
  @Patch(':id/location') async location(@Param('id') id: string, @Body() body: { lat: number; lon: number }){
    await this.ds.query('UPDATE workers SET lat=$2, lon=$3 WHERE user_id=$1', [id, body.lat, body.lon]);
    return { ok: true };
  }
}
