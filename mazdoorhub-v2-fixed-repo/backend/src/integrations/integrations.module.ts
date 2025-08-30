codex/register-redisservice-and-refactor-jobs-controller
import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { RedisService } from './redis.service';
import { S3Service } from './s3.service';
import { SmsService } from './sms.service';
import { OrsService } from './ors.service';

main
@Module({
  providers: [S3Service, PushService, SmsService, OrsService, RedisService],
  exports: [S3Service, PushService, SmsService, OrsService, RedisService],
})
export class IntegrationsModule {}
