import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JobType, JobStatus, JobEventType } from '../../../../domain/job';

@Entity('jobs')
export class JobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: JobType,
  })
  type: JobType;

  @Column({
    type: 'enum',
    enum: JobEventType,
  })
  eventType: JobEventType;

  @Column({ type: 'numeric' })
  fromBlock: number;

  @Column({ type: 'numeric' })
  toBlock: number;

  @Column({ type: 'varchar', nullable: true })
  contractAddress: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  eventNames: string[] | null;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
