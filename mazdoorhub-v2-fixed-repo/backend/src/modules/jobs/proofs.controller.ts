import { Controller, Post, Param, Body } from '@nestjs/common';
import { S3Service } from '../../integrations/s3.service';
import { DataSource } from 'typeorm';
@Controller('v1/jobs')
export class ProofsController {
  constructor(private s3: S3Service, private ds: DataSource) {}
  @Post(':id/proofs/presign') async presign(@Param('id') id: string, @Body() body: { uploader_id: string; role: 'worker'|'employer'; kind?: string }){
    const key = `proofs/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${body.kind==='audio'?'m4a':'jpg'}`;
    const { url } = await this.s3.presignPut(key, body.kind==='audio'?'audio/aac':'image/jpeg');
    return { url, key };
  }
  @Post(':id/proofs/attach') async attach(@Param('id') id: string, @Body() body: { uploader_id: string; role: 'worker'|'employer'; key: string; kind?: string }){
    const q = `INSERT INTO job_proofs (job_id, uploader_id, role, key, kind) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
    const r = await this.ds.query(q, [id, body.uploader_id, body.role, body.key, body.kind || 'photo']);
    return r[0];
  }
}
