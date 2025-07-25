import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventLog, ethers } from 'ethers';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import {
  formatEtherNumber,
  formatTimestamp,
  convertToDays,
} from '../../utils/helper';
import { Web3Service } from '../../web3/web3.service';
import { AllConfigType } from '../../config/config.type';
import { IWeb3Config } from '../../config/app-config.type';
import { StakingEventsService } from '../../staking-events/staking-events.service';
import {
  CRON_DURATION,
  MILLI_SECS_PER_SEC,
  ONE_DAY_BLOCK_RANGE,
  ONE_MONTH_BLOCK_RANGE,
  WORKER_MODE,
} from '../../utils/const';
import { BlockRange, IBatch } from '../../utils/types/common.type';
import { CheckpointsService } from '../../checkpoints/checkpoints.service';
import { QueryType } from '../../utils/common.type';

@Injectable()
export class StakingFetchService implements OnModuleInit {
  private readonly logger = new Logger(StakingFetchService.name);
  private newestBlock: number = 0;
  private web3Config: IWeb3Config | undefined;
  private stakingContract: ethers.Contract;

  constructor(
    private readonly web3Service: Web3Service,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly stakingEventsService: StakingEventsService,
    private readonly checkpointsService: CheckpointsService,
    @InjectQueue('blockchain-index-event') private readonly queue: Queue,
  ) {
    this.web3Config = this.configService.get('app.web3Config', {
      infer: true,
    });
    this.stakingContract = this.web3Service.getStakingContract();
  }

  async onModuleInit(): Promise<void> {
    const isCrawlMode = this.web3Config?.workerMode === WORKER_MODE.CRAWL;

    if (!isCrawlMode) {
      this.logger.log('This is not crawl mode, skipping');
      return;
    }

    await this.handleQueryBlocks();
  }

  @Cron(CRON_DURATION.EVERY_3_MINUTES)
  async handleCron() {
    const isListenMode = this.web3Config?.workerMode === WORKER_MODE.LISTEN;

    if (!isListenMode) {
      this.logger.log('This is not listen mode, skipping');
      return;
    }

    await this.handleQueryBlocks();
  }

  async handleQueryBlocks() {
    await this.processFailedCheckpoints();

    const queryBlocks = {
      fromBlock: 0,
      toBlock: 0,
    };

    try {
      this.newestBlock = await this.web3Service.getCurrentBlock();
      this.logger.log(`Newest on chain block: ${this.newestBlock}`);
      const latestCheckpoint =
        await this.checkpointsService.findLatestCheckpoint(
          QueryType.FETCH_STAKING,
        );

      if (!latestCheckpoint) {
        this.logger.warn(
          'No latest checkpoint found, start fetching from genesis`',
        );

        const fetchFromMonthAgo = this.web3Config?.initDataDuration || 12; //month
        let fromBlock =
          this.newestBlock - fetchFromMonthAgo * ONE_MONTH_BLOCK_RANGE;
        fromBlock = Math.max(fromBlock, 0);

        queryBlocks.fromBlock = fromBlock;
        queryBlocks.toBlock = this.newestBlock;
      } else {
        const latestBlockNumber = Number(latestCheckpoint.toBlockNumber);
        queryBlocks.fromBlock = latestBlockNumber + 1;
        queryBlocks.toBlock = this.newestBlock;
      }

      if (queryBlocks.fromBlock > queryBlocks.toBlock) {
        this.logger.log('No new blocks to fetch, skipping');
        return;
      }

      await this.fetchStakingEvents(queryBlocks.fromBlock, queryBlocks.toBlock);
    } catch (error) {
      this.logger.error('Failed to handle query blocks', error);
      throw error;
    }
  }

  async processFailedCheckpoints() {
    try {
      const failedCheckpoints =
        await this.checkpointsService.findFailedCheckpoints(
          QueryType.FETCH_STAKING,
        );

      if (failedCheckpoints.length === 0) {
        this.logger.log('No staking failed checkpoints found, skipping...');
        return;
      }

      const failedRanges: BlockRange[] = [];

      for (const checkpoint of failedCheckpoints) {
        const latestBlockNumber =
          await this.stakingEventsService.getLatestStakeBlockNumberInRange(
            Number(checkpoint.fromBlockNumber),
            Number(checkpoint.toBlockNumber),
          );

        if (!latestBlockNumber) {
          this.logger.log(
            `refetch staking from ${checkpoint.fromBlockNumber} to ${checkpoint.toBlockNumber}`,
          );
          failedRanges.push({
            from: Number(checkpoint.fromBlockNumber),
            to: Number(checkpoint.toBlockNumber),
            checkpointId: checkpoint.id,
          });
          continue;
        }

        if (latestBlockNumber >= Number(checkpoint.toBlockNumber)) {
          this.logger.log(`invalid failed latest block number, skipping...`);
          continue;
        }

        this.logger.log(
          `refetch staking from ${Number(latestBlockNumber) + 1} to ${checkpoint.toBlockNumber}`,
        );

        failedRanges.push({
          from: Number(latestBlockNumber) + 1,
          to: Number(checkpoint.toBlockNumber),
          checkpointId: checkpoint.id,
        });
      }

      await this.queryRanges(failedRanges, QueryType.REFRESH_FAILED_STAKING);
    } catch (error) {
      this.logger.error('Failed to process failed checkpoints', error);
      throw error;
    }
  }

  async fetchStakingEvents(fromBlock: number, toBlock: number): Promise<void> {
    try {
      this.validateBlockRange(fromBlock, toBlock);

      this.logger.log(
        `Fetching staking events from block ${fromBlock} to ${toBlock}`,
      );

      const splitRanges = this.splitIntoRanges(
        fromBlock,
        toBlock,
        ONE_DAY_BLOCK_RANGE,
      );
      await this.queryRanges(splitRanges, QueryType.FETCH_STAKING);
    } catch (error) {
      throw error;
    }
  }

  validateBlockRange(fromBlock: number, toBlock: number): void {
    if (fromBlock < 0 || toBlock < 0) {
      throw new Error('Block numbers must be non-negative');
    }
    if (fromBlock > toBlock) {
      throw new Error('From block must be less than or equal to to block');
    }
  }

  splitIntoRanges(
    fromBlock: number,
    toBlock: number,
    splitValue: number,
  ): BlockRange[] {
    const ranges: BlockRange[] = [];

    for (let current = fromBlock; current < toBlock; current += splitValue) {
      const rangeEnd = Math.min(current + splitValue - 1, toBlock);
      ranges.push({ from: current, to: rangeEnd });
    }

    return ranges;
  }

  async queryRanges(ranges: BlockRange[], type: string): Promise<void> {
    try {
      for (const range of ranges) {
        await this.queue.add(type, {
          type,
          fromBlock: range.from,
          toBlock: range.to,
          ...(range.checkpointId && {
            checkpointId: range.checkpointId,
          }),
        });
        // Prevent rate limit among requests
        await this.delay(MILLI_SECS_PER_SEC);
      }
    } catch (error) {
      this.logger.error('Failed to query ranges', error);
      throw error;
    }
  }

  async executeRangeQuery(range: BlockRange): Promise<void> {
    try {
      const allEvents: EventLog[] = [];
      const batches = this.createBatches(range.from, range.to);
      const promises = batches.map((batch) => {
        return this.web3Service.fetchStaking(batch.from, batch.to);
      });

      const batchResults = await Promise.all(promises);
      const events = batchResults.flat() as EventLog[];
      allEvents.push(...events);

      await this.logEvents(allEvents);
      await this.checkpointsService.saveLatestCheckpoint(
        range.to,
        range.from,
        QueryType.FETCH_STAKING,
        false,
      );
    } catch (error) {
      await this.checkpointsService.saveLatestCheckpoint(
        range.to,
        range.from,
        QueryType.FETCH_STAKING,
        true,
      );
      throw error;
    }
  }

  async executeFailedRangeQuery(
    range: BlockRange,
    checkpointId: string,
  ): Promise<void> {
    const allEvents: EventLog[] = [];
    try {
      const batches = this.createBatches(range.from, range.to);
      const promises = batches.map((batch) => {
        return this.web3Service.fetchStaking(batch.from, batch.to);
      });

      const batchResults = await Promise.all(promises);
      const events = batchResults.flat() as EventLog[];
      allEvents.push(...events);

      await this.logEvents(allEvents);
      await this.checkpointsService.update(checkpointId, {
        isFailed: false,
      });
    } catch (error) {
      throw error;
    }
  }

  createBatches(fromBlock: number, toBlock: number): IBatch[] {
    const maxBlockRange = this.web3Config?.maxQueryBlockRange || 10000;
    const batches: IBatch[] = [];

    for (
      let current = fromBlock;
      current <= toBlock;
      current += maxBlockRange
    ) {
      const batchEnd = Math.min(current + maxBlockRange - 1, toBlock);
      batches.push({ from: current, to: batchEnd });
    }

    return batches;
  }

  async findStake(
    user: string,
    amount: bigint,
    startTime: bigint,
    duration: bigint,
  ): Promise<any> {
    try {
      if (!user || !ethers.isAddress(user)) {
        this.logger.warn(`Invalid user address: ${user}`);
        return null;
      }

      const totalStakes = await this.stakingContract.getActiveStakes(user);

      if (!Array.isArray(totalStakes)) {
        this.logger.warn(
          `Invalid response from getActiveStakes for user ${user}`,
        );
        return null;
      }

      const stake = totalStakes.find(
        (stake) =>
          formatEtherNumber(stake.amount) === formatEtherNumber(amount) &&
          formatTimestamp(stake.startTime) === formatTimestamp(startTime) &&
          convertToDays(Number(stake.duration)) ===
            convertToDays(Number(duration)),
      );

      return stake || null;
    } catch (error) {
      this.logger.error(`Failed to find stake for user ${user}:`, error);
      return null;
    }
  }

  async logEvents(events: EventLog[]): Promise<void> {
    if (!Array.isArray(events) || events.length === 0) {
      this.logger.log('No staking events found');
      return;
    }

    this.logger.log(`Processing ${events.length} staking events`);

    for (const event of events) {
      await this.processStakingEvent(event);
    }

    this.logger.log('Finished processing staking events');
  }

  async processStakingEvent(event: EventLog): Promise<void> {
    const [user, amount, startTime, duration] = event.args;

    if (!user || !amount || !startTime || !duration) {
      this.logger.warn(
        `Invalid event args for transaction ${event.transactionHash}`,
      );
      return;
    }

    const stake = await this.findStake(user, amount, startTime, duration);

    const stakingEvent = {
      txHash: event.transactionHash,
      walletAddress: user,
      amount: String(formatEtherNumber(amount)),
      startTime: String(formatTimestamp(startTime)),
      duration: String(convertToDays(Number(duration))),
      blockNumber: String(event.blockNumber),
      hasWithdrawal: stake?.hasWithdrawn || false,
      withdrawalTime: stake?.withdrawalTime
        ? formatTimestamp(stake.withdrawalTime)
        : null,
    };

    await this.stakingEventsService.create(stakingEvent);
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
