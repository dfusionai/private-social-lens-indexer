import { Job } from '../../../../domain/job';
import { JobEntity } from '../entities/job.entity';

export class JobMapper {
  static toDomain(entity: JobEntity): Job {
    return new Job({
      id: entity.id,
      type: entity.type,
      eventType: entity.eventType,
      fromBlock: Number(entity.fromBlock),
      toBlock: Number(entity.toBlock),
      contractAddress: entity.contractAddress || undefined,
      eventNames: entity.eventNames || undefined,
      status: entity.status,
      attempts: entity.attempts,
      maxAttempts: entity.maxAttempts,
      lastAttemptAt: entity.lastAttemptAt || undefined,
      completedAt: entity.completedAt || undefined,
      errorMessage: entity.errorMessage || undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: Job): JobEntity {
    const entity = new JobEntity();
    entity.id = domain.id;
    entity.type = domain.type;
    entity.eventType = domain.eventType;
    entity.fromBlock = domain.fromBlock;
    entity.toBlock = domain.toBlock;
    entity.contractAddress = domain.contractAddress || null;
    entity.eventNames = domain.eventNames || null;
    entity.status = domain.status;
    entity.attempts = domain.attempts;
    entity.maxAttempts = domain.maxAttempts;
    entity.lastAttemptAt = domain.lastAttemptAt || null;
    entity.completedAt = domain.completedAt || null;
    entity.errorMessage = domain.errorMessage || null;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
