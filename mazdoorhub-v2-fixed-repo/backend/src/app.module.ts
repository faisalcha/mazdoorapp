import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { UsersModule } from './modules/users/users.module';
import { WorkersModule } from './modules/workers/workers.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { SkillsModule } from './modules/skills/skills.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { EarningsModule } from './modules/earnings/earnings.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { RebroadcastService } from './rebroadcast.service';
import { AutoAvailabilityService } from './auto-availability.service';
import { AuthModule } from './modules/auth/auth.module';
import { PreferencesController } from './modules/workers/preferences.controller';
import { ProofsController } from './modules/jobs/proofs.controller';
import { TipsController } from './modules/jobs/tips.controller';
import { SosController } from './modules/safety/sos.controller';
import { LoansController } from './modules/loans/loans.controller';
import { InboundSmsController } from './modules/inbound/sms.controller';
import { DevicesModule } from './modules/devices/devices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT || 5432),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        autoLoadEntities: true,
        synchronize: false
      }),
    }),
    UsersModule,
    WorkersModule,
    JobsModule,
    SkillsModule,
    RatingsModule,
    EarningsModule,
    IntegrationsModule,
    AuthModule,
    DevicesModule
  ],
  controllers: [PreferencesController, ProofsController, TipsController, SosController, LoansController, InboundSmsController],
  providers: [RebroadcastService, AutoAvailabilityService],
})
export class AppModule {}
