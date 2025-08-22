import { Injectable, Logger } from '@nestjs/common';
import { JobRepository } from './infrastructure/persistence/relational/repositories/job.repository';
import { Job, JobStatus } from './domain/job';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly jobRepository: JobRepository) {}

  async createJob(job: Job): Promise<Job> {
    this.logger.log(
      `Creating job ${job.type} for blocks ${job.fromBlock}-${job.toBlock}`,
    );
    return this.jobRepository.create(job);
  }

  async getPendingJobs(limit: number = 100): Promise<Job[]> {
    return this.jobRepository.findPendingJobs(limit);
  }

  async getFailedJobs(limit: number = 100): Promise<Job[]> {
    return this.jobRepository.findFailedJobs(limit);
  }

  async getQueueJobs(limit: number = 100): Promise<Job[]> {
    return this.jobRepository.findQueueJobs(limit);
  }

  async getCompletedJobs(limit: number = 100): Promise<Job[]> {
    return this.jobRepository.findCompletedJobs(limit);
  }

  async getRunningJobs(limit: number = 100): Promise<Job[]> {
    return this.jobRepository.findRunningJobs(limit);
  }

  async getJobById(id: string): Promise<Job | null> {
    return this.jobRepository.findById(id);
  }

  async updateJob(job: Job): Promise<Job> {
    return this.jobRepository.update(job);
  }

  async deleteJob(id: string): Promise<void> {
    await this.jobRepository.delete(id);
  }

  async getStatistics(): Promise<{
    pending: number;
    queued: number;
    completed: number;
    failed: number;
    running: number;
  }> {
    const [pending, queued, completed, failed, running] = await Promise.all([
      this.jobRepository.countByStatus(JobStatus.PENDING),
      this.jobRepository.countByStatus(JobStatus.QUEUED),
      this.jobRepository.countByStatus(JobStatus.COMPLETED),
      this.jobRepository.countByStatus(JobStatus.FAILED),
      this.jobRepository.countByStatus(JobStatus.RUNNING),
    ]);

    return { pending, queued, completed, failed, running };
  }

  async retryJobsByIds(jobIds: string[]): Promise<{
    retried: string[];
    skipped: string[];
    notFound: string[];
    message: string;
  }> {
    const retried: string[] = [];
    const skipped: string[] = [];
    const notFound: string[] = [];

    for (const jobId of jobIds) {
      try {
        const job = await this.jobRepository.findById(jobId);

        if (!job) {
          notFound.push(jobId);
          this.logger.warn(`Job ${jobId} not found`);
          continue;
        }

        if (job.status !== JobStatus.FAILED) {
          skipped.push(jobId);
          this.logger.warn(
            `Job ${jobId} is not in FAILED status (current: ${job.status})`,
          );
          continue;
        }

        job.resetForRetry();
        await this.jobRepository.update(job);
        retried.push(jobId);
        this.logger.log(`Reset failed job ${jobId} for retry`);
      } catch (error) {
        this.logger.error(`Error retrying job ${jobId}:`, error);
        skipped.push(jobId);
      }
    }

    return {
      retried,
      skipped,
      notFound,
      message: `Retry operation completed. Retried: ${retried.length}, Skipped: ${skipped.length}, Not Found: ${notFound.length}`,
    };
  }
}
