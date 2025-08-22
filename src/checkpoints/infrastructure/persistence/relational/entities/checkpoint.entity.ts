import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { JobEventType } from '../../../../../jobs/domain/job';

@Entity({
  name: 'checkpoint',
})
export class CheckpointEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'numeric',
  })
  toBlockNumber: number;

  @Column({
    type: 'numeric',
  })
  fromBlockNumber: number;

  @Column({
    type: 'enum',
    enum: JobEventType,
  })
  queryType: JobEventType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
