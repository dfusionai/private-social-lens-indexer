import { Injectable, Logger } from '@nestjs/common';
import { JobRepository } from '../jobs/infrastructure/persistence/relational/repositories/job.repository';
import { JobStatus } from '../jobs/domain/job';

@Injectable()
export class JobRecoveryService {
  private readonly logger = new Logger(JobRecoveryService.name);

  constructor(private readonly jobRepository: JobRepository) {}

  onModuleInit() {
    // Delay recovery to allow other services to initialize
    setTimeout(async () => {
      await this.resetStuckJobsToPending();
    }, 5000); // 5 second delay
  }

  /**
   * Reset all RUNNING and QUEUED jobs back to PENDING status
   * This is useful when the application restarts and there are jobs
   * that were running or queued but got interrupted
   */
  async resetStuckJobsToPending() {
    try {
      this.logger.log('🔄 Starting job recovery process...');

      // Get count of stuck jobs before reset
      const runningJobsCount = await this.jobRepository.countByStatus(
        JobStatus.RUNNING,
      );

      if (runningJobsCount === 0) {
        this.logger.log('✅ No stuck jobs found to reset');
        return { totalStuckJobs: 0 };
      }

      this.logger.log(`🔄 Found ${runningJobsCount} running jobs to reset`);

      // Reset all stuck jobs to pending
      const { runningReset } =
        await this.jobRepository.resetStuckJobsToPending();

      this.logger.log(
        `✅ Successfully reset ${runningReset} running jobs to pending status`,
      );

      return {
        totalStuckJobs: runningJobsCount,
      };
    } catch (error) {
      this.logger.error('❌ Error during job recovery:', error);
    }
  }
}
