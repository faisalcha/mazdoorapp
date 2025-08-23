import { Controller, Post, Body } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DataSource } from 'typeorm';
@Controller('v1/auth')
export class SocialAuthController {
  constructor(private ds: DataSource) {}
  @Post('social') async social(@Body() body: { idToken: string; role: 'employer'|'worker' }){
    const name = 'User ' + uuid().slice(0,8);
    const role = body.role || 'employer';
    const u = await this.ds.query(`INSERT INTO users(name, role) VALUES ($1,$2) RETURNING *`, [name, role]);
    return { token: 'dummy.'+u[0].id+'.token', user: u[0] };
  }
}
