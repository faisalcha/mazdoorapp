import 'reflect-metadata'; import * as dotenv from 'dotenv'; dotenv.config();
import { DataSource } from 'typeorm'; import * as fs from 'fs'; import * as path from 'path';
(async () => {
  const ds = new DataSource({ type:'postgres', host:process.env.POSTGRES_HOST, port:Number(process.env.POSTGRES_PORT||5432), username:process.env.POSTGRES_USER, password:process.env.POSTGRES_PASSWORD, database:process.env.POSTGRES_DB });
  await ds.initialize();
  const dir = path.resolve(__dirname, '../../..', 'db/init');
  const files = fs.readdirSync(dir).sort();
  for (const f of files) { const p = path.join(dir, f); const sql = fs.readFileSync(p, 'utf-8'); console.log('> applying', f); await ds.query(sql); }
  await ds.destroy();
  console.log('Migrations applied.');
})().catch(e=>{ console.error(e); process.exit(1)});
