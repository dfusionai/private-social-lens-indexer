export enum JobType {
  CRAWL_CHUNK = 'CRAWL_CHUNK',
  LISTEN_CHUNK = 'LISTEN_CHUNK',
}

export enum JobStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum JobEventType {
  REQUEST_REWARD = 'REQUEST_REWARD',
  STAKING = 'STAKING',
  UNSTAKING = 'UNSTAKING',
}

export class Job {
  id: string;
  type: JobType;
  eventType: JobEventType;
  fromBlock: number;
  toBlock: number;
  contractAddress?: string;
  eventNames?: string[];
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Job>) {
    Object.assign(this, partial);
  }

  static create(
    type: JobType,
    eventType: JobEventType,
    fromBlock: number,
    toBlock: number,
    contractAddress?: string,
    eventNames?: string[],
    maxAttempts: number = 3,
  ): Job {
    return new Job({
      type,
      eventType,
      fromBlock,
      toBlock,
      contractAddress,
      eventNames,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  markAsQueued(): void {
    this.status = JobStatus.QUEUED;
    this.updatedAt = new Date();
  }

  markAsRunning(): void {
    this.status = JobStatus.RUNNING;
    this.lastAttemptAt = new Date();
    this.updatedAt = new Date();
  }

  markAsCompleted(): void {
    this.status = JobStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  markAsFailed(errorMessage: string): void {
    this.status = JobStatus.FAILED;
    this.attempts += 1;
    this.lastAttemptAt = new Date();
    this.errorMessage = errorMessage;
    this.updatedAt = new Date();
  }

  canRetry(): boolean {
    return this.attempts < this.maxAttempts;
  }

  resetForRetry(): void {
    this.status = JobStatus.PENDING;
    this.errorMessage = undefined;
    this.updatedAt = new Date();
  }
}
