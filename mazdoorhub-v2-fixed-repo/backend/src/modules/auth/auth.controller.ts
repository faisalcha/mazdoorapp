import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuid } from 'uuid';
import { DataSource } from 'typeorm';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

@Controller('v1/auth')
export class SocialAuthController {
  constructor(private ds: DataSource, private jwt: JwtService) {}

  @Post('social')
  async social(
    @Body() body: { idToken: string; role: 'employer' | 'worker' },
  ) {
    try {
      await admin.auth().verifyIdToken(body.idToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }

    const name = 'User ' + uuid().slice(0, 8);
    const role = body.role || 'employer';
    const u = await this.ds.query(
      `INSERT INTO users(name, role) VALUES ($1,$2) RETURNING *`,
      [name, role],
    );
    const token = await this.jwt.signAsync({ id: u[0].id, role });
    return { token, user: u[0] };
  }
}
