import { Controller, Post, Body, ForbiddenException } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';

@Controller('v1/inbound')
export class InboundSmsController {
  constructor(private jobs: JobsService) {}

  @Post('sms')
  async sms(@Body() body: { secret: string; text: string }) {
    if (body.secret !== process.env.SMS_INBOUND_SECRET)
      throw new ForbiddenException('forbidden');
    const m = body.text.trim().split(/\s+/);
    if (m[0]?.toUpperCase() === 'ACCEPT' && m.length >= 5) {
      const [, jobId, workerId, employerId, amountStr] = m;
      const amt = Number(amountStr);
      const job = await this.jobs.accept(jobId, workerId, employerId, amt);
      return { ok: true, job };
    }
    return { ok: false, reason: 'unrecognized' };
  }
}
