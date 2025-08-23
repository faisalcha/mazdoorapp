import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { PushService } from './push.service';
import { SmsService } from './sms.service';
import { OrsService } from './ors.service';
import { RedisService } from './redis.service';
@Module({ providers:[S3Service,PushService,SmsService,OrsService,RedisService], exports:[S3Service,PushService,SmsService,OrsService,RedisService] })
export class IntegrationsModule {}
