import 'reflect-metadata'; import * as dotenv from 'dotenv'; dotenv.config();
import { DataSource } from 'typeorm';
(async () => {
  const ds = new DataSource({ type:'postgres', host:process.env.POSTGRES_HOST, port:Number(process.env.POSTGRES_PORT||5432), username:process.env.POSTGRES_USER, password:process.env.POSTGRES_PASSWORD, database:process.env.POSTGRES_DB });
  await ds.initialize();
  const u1 = await ds.query(`INSERT INTO users (name, role) VALUES ('Employer One','employer') RETURNING *`);
  const u2 = await ds.query(`INSERT INTO users (name, role) VALUES ('Worker One','worker') RETURNING *`);
  await ds.query(`INSERT INTO workers (user_id, availability, kyc_status, lat, lon) VALUES ($1,true,'verified',24.8607,67.0011)`, [u2[0].id]);
  console.log('Seeded users:', u1[0].id, u2[0].id);
  await ds.destroy();
})().catch(e=>{ console.error(e); process.exit(1)});
