import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Job, JobType, JobStatus, JobEventType } from '../jobs/domain/job';
import { JobRepository } from '../jobs/infrastructure/persistence/relational/repositories/job.repository';
import { Web3Service } from '../web3/web3.service';
import { AllConfigType } from '../config/config.type';
import { ONE_DAY_BLOCK_RANGE } from '../utils/const';
import { CheckpointsService } from '../checkpoints/checkpoints.service';
import { IWeb3Config } from '../config/app-config.type';

@Injectable()
export class IndexingOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(IndexingOrchestratorService.name);
  private provider: ethers.Provider;
  private web3Config: IWeb3Config | undefined;
  private currentBlock: number = 0;
  private dlpContractAddress: string = '';
  private stakingContractAddress: string = '';

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly web3Service: Web3Service,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly checkpointsService: CheckpointsService,
    //add contract address for dlp, staking conteract
    @InjectQueue('blockchain-index-event') private readonly queue: Queue,
  ) {
    this.provider = this.web3Service.getProvider();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Indexing Orchestrator Service...');

    // Initialize configuration
    this.web3Config = this.configService.get('app.web3Config', { infer: true });
    this.currentBlock = await this.provider.getBlockNumber();
    this.dlpContractAddress = this.web3Config?.dlpContractAddress ?? '';
    this.stakingContractAddress = this.web3Config?.stakingContractAddress ?? '';

    // Validate required configuration
    if (!this.dlpContractAddress) {
      this.logger.error('DLP contract address is not configured');
      return;
    }
    if (!this.stakingContractAddress) {
      this.logger.error('Staking contract address is not configured');
      return;
    }

    this.logger.log(`Current block: ${this.currentBlock}`);
    this.logger.log(`DLP contract: ${this.dlpContractAddress}`);
    this.logger.log(`Staking contract: ${this.stakingContractAddress}`);

    await this.initializeIndexing();
  }

  // Initialize indexing
  private async initializeIndexing(): Promise<void> {
    try {
      const startBlock = this.configService.get('app.web3Config.startBlock', {
        infer: true,
      });

      if (!startBlock) {
        this.logger.error('Start block is not set');
        return;
      }

      //get latest checkpoint
      const lastIndexedBlock = (await this.getLatestCheckpoint()) || 0;

      let actualStartBlock;

      if (lastIndexedBlock >= startBlock) {
        actualStartBlock = lastIndexedBlock + 1;
      } else {
        actualStartBlock = startBlock;
      }

      await this.startCrawlJobs(actualStartBlock, this.currentBlock);
    } catch (error) {
      this.logger.error('Error initializing indexing:', error);
    }
  }

  // Start CRAWL jobs from startBlock to endBlock
  private async startCrawlJobs(
    startBlock: number,
    endBlock: number,
  ): Promise<void> {
    try {
      // Check if we need to crawl (startBlock should be less than or equal to endBlock)
      if (startBlock > endBlock) {
        this.logger.log(
          `Start block ${startBlock} is > end block ${endBlock}, skipping CRAWL`,
        );
        return;
      }

      this.logger.log(
        `Starting crawling from block ${startBlock} to ${endBlock}`,
      );

      await this.crawlBlockRange(startBlock, endBlock, JobType.CRAWL_CHUNK);
    } catch (error) {
      this.logger.error('Error starting CRAWL:', error);
    }
  }

  // CRAWL: Accepts a block range and breaks it into chunks
  async crawlBlockRange(
    fromBlock: number,
    toBlock: number,
    jobType: JobType,
  ): Promise<string[]> {
    this.logger.log(
      `Starting ${jobType} for blocks ${fromBlock} to ${toBlock}`,
    );

    // Use the same chunking logic as req-reward-fetch service
    const splitRanges = this.splitIntoRanges(
      fromBlock,
      toBlock,
      ONE_DAY_BLOCK_RANGE,
    );

    const jobIds: string[] = [];

    // Create jobs for each event type
    for (const range of splitRanges) {
      // Create job for REQUEST_REWARD events
      const requestRewardJob = Job.create(
        jobType,
        JobEventType.REQUEST_REWARD,
        range.from,
        range.to,
        this.dlpContractAddress,
      );
      const reqRewardJob = await this.jobRepository.create(requestRewardJob);
      jobIds.push(reqRewardJob.id);

      // Create job for STAKING events
      const stakingJob = Job.create(
        jobType,
        JobEventType.STAKING,
        range.from,
        range.to,
        this.stakingContractAddress,
      );
      const stakeJob = await this.jobRepository.create(stakingJob);
      jobIds.push(stakeJob.id);

      // Create job for UNSTAKING events
      const unstakingJob = Job.create(
        jobType,
        JobEventType.UNSTAKING,
        range.from,
        range.to,
        this.stakingContractAddress,
      );
      const unstakeJob = await this.jobRepository.create(unstakingJob);
      jobIds.push(unstakeJob.id);

      this.logger.log(
        `Created jobs for blocks ${range.from}-${range.to} (REQUEST_REWARD, STAKING, UNSTAKING)`,
      );
    }

    // Create checkpoints for job creation
    await this.createJobCreationCheckpoints(fromBlock, toBlock);

    return jobIds;
  }

  // LISTEN: Check for new blocks and create jobs
  @Cron(CronExpression.EVERY_MINUTE)
  async listenForNewBlocks(): Promise<void> {
    try {
      const lastIndexedBlock = (await this.getLatestCheckpoint()) || 0;

      let startBlock: number;
      if (this.currentBlock > lastIndexedBlock) {
        // Use current block as start block if it's ahead of last indexed block
        startBlock = this.currentBlock;
      } else {
        // Use last indexed block + 1 as start block
        startBlock = lastIndexedBlock + 1;
      }

      // Get the latest block from chain again for end block
      const endBlock = await this.provider.getBlockNumber();

      // Check if start block is before or equal to end block
      if (startBlock > endBlock) {
        this.logger.log(
          `Start block (${startBlock}) is > end block (${endBlock}), skipping LISTEN`,
        );
        return;
      }

      this.logger.log(`Listening from block ${startBlock} to ${endBlock}`);

      await this.crawlBlockRange(startBlock, endBlock, JobType.LISTEN_CHUNK);
    } catch (error) {
      this.logger.error('Error in listenForNewBlocks:', error);
    }
  }

  // Poll jobs for pending tasks and queue them
  @Cron(CronExpression.EVERY_MINUTE)
  async pollJobs(): Promise<void> {
    try {
      const pendingJobs = await this.jobRepository.findPendingJobs(50);

      for (const job of pendingJobs) {
        const queueJob = await this.queue.add(
          job.eventType,
          {
            taskId: job.id,
            eventType: job.eventType,
            fromBlock: job.fromBlock,
            toBlock: job.toBlock,
            contractAddress: job.contractAddress,
            eventNames: job.eventNames,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );

        job.markAsQueued();
        await this.jobRepository.update(job);

        this.logger.log(
          `Queued job ${job.id} (${job.eventType}) as queue job ${queueJob.id} for blocks ${job.fromBlock}-${job.toBlock}`,
        );
      }
    } catch (error) {
      this.logger.error('Error in pollJobs:', error);
    }
  }

  // Retry failed jobs
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedJobs(): Promise<void> {
    try {
      // retry jobs of which the last attempt was more than 5 minutes ago
      const failedJobs = await this.jobRepository.findOldFailedJobs(5);

      for (const job of failedJobs) {
        if (job.canRetry()) {
          job.resetForRetry();
          await this.jobRepository.update(job);
          this.logger.log(
            `Reset failed ${job.type} job ${job.id} (${job.eventType}) for retry`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in retryFailedJobs:', error);
    }
  }

  // remove completed jobs older than 1 day
  @Cron(CronExpression.EVERY_10_MINUTES)
  async removeCompletedJobs(): Promise<void> {
    try {
      this.logger.log('Starting cleanup of old completed jobs');

      // Remove completed jobs older than 1 days
      await this.jobRepository.removeCompletedJobs(1);

      this.logger.log('Completed cleanup of old completed jobs');
    } catch (error) {
      this.logger.error('Failed to cleanup completed jobs:', error);
    }
  }

  // Use the same chunking logic as req-reward-fetch service
  private splitIntoRanges(
    fromBlock: number,
    toBlock: number,
    splitValue: number,
  ): Array<{ from: number; to: number }> {
    const ranges: Array<{ from: number; to: number }> = [];

    for (let current = fromBlock; current <= toBlock; current += splitValue) {
      const rangeEnd = Math.min(current + splitValue - 1, toBlock);
      ranges.push({ from: current, to: rangeEnd });
    }

    return ranges;
  }

  async getStatistics(): Promise<{
    pending: number;
    queued: number;
    completed: number;
    failed: number;
    totalEvents: number;
    lastIndexedBlock: number;
    oldestIndexBlock: number;
  }> {
    const [pending, queued, completed, failed] = await Promise.all([
      this.jobRepository.countByStatus(JobStatus.PENDING),
      this.jobRepository.countByStatus(JobStatus.QUEUED),
      this.jobRepository.countByStatus(JobStatus.COMPLETED),
      this.jobRepository.countByStatus(JobStatus.FAILED),
    ]);

    const lastIndexedBlock = (await this.getLatestCheckpoint()) || 0;

    const oldestIndexBlock = (await this.getOldestCheckpoint()) || 0;

    // Note: We don't have a count method for indexed events yet
    const totalEvents = 0;

    return {
      pending,
      queued,
      completed,
      failed,
      totalEvents,
      lastIndexedBlock,
      oldestIndexBlock,
    };
  }

  /**
   * Get the latest checkpoint from all event types
   */
  private async getLatestCheckpoint() {
    try {
      const latestCheckpoint =
        await this.checkpointsService.findLatestCheckpoint();

      return Number(latestCheckpoint?.toBlockNumber || 0);
    } catch (error) {
      this.logger.error('Error getting latest checkpoint:', error);
    }
  }

  /**
   * Get the oldest checkpoint from all event types
   */
  private async getOldestCheckpoint() {
    try {
      const oldestCheckpoint =
        await this.checkpointsService.findOldestCheckpoint();

      return Number(oldestCheckpoint?.fromBlockNumber || 0);
    } catch (error) {
      this.logger.error('Error getting oldest checkpoint:', error);
    }
  }

  /**
   * Create checkpoints for job creation
   */
  private async createJobCreationCheckpoints(
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    try {
      // Create checkpoints for each event type
      const eventTypes = [
        JobEventType.REQUEST_REWARD,
        JobEventType.STAKING,
        JobEventType.UNSTAKING,
      ];

      for (const eventType of eventTypes) {
        await this.checkpointsService.create({
          fromBlockNumber: fromBlock.toString(),
          toBlockNumber: toBlock.toString(),
          queryType: eventType,
        });
      }

      this.logger.log(
        `📝 Created job creation checkpoints for blocks ${fromBlock}-${toBlock}`,
      );
    } catch (error) {
      this.logger.error('Error creating job creation checkpoints:', error);
    }
  }
}
