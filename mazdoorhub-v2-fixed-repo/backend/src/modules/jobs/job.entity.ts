import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity({ name: 'jobs' })
export class Job {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ nullable: true }) employer_id!: string | null;
  @Column({ type: 'int', nullable: true }) skill_id!: number | null;
  @Column({ nullable: true }) title!: string | null;
  @Column({ nullable: true }) description!: string | null;
  @Column({ nullable: true }) budget_type!: string | null;
  @Column({ type: 'int', nullable: true }) budget_amount!: number | null;
  @Column({ type: 'double precision', nullable: true }) lat!: number | null;
  @Column({ type: 'double precision', nullable: true }) lon!: number | null;
  @Column({ default: 'posted' }) status!: string;
  @Column({ type: 'uuid', nullable: true }) accepted_worker_id!: string | null;
  @Column({ type: 'int', default: 0 }) broadcast_attempts!: number;
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1.00 }) surge_multiplier!: number;
  @Column({ type: 'int', default: 0 }) guarantee_min_pkr!: number;
  @Column({ type: 'int', default: 0 }) material_amount!: number;
  @Column({ type: 'int', nullable: true }) arrival_eta_min!: number | null;
  @Column({ type: 'timestamp', nullable: true }) scheduled_start_ts!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) scheduled_end_ts!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) completed_at!: Date | null;
  @CreateDateColumn() created_at!: Date;
}
