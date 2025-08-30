import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SocialAuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1h' }
    })
  ],
  controllers: [SocialAuthController]
})
export class AuthModule {}
