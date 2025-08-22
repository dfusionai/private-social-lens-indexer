import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventLog, ethers } from 'ethers';
import { IWeb3Config } from '../../config/app-config.type';
import { AllConfigType } from '../../config/config.type';
import { StakingEventsService } from '../../staking-events/staking-events.service';
import {
  convertToDays,
  formatEtherNumber,
  formatTimestamp,
} from '../../utils/helper';
import { BlockRange, IBatch } from '../../utils/types/common.type';
import { Web3Service } from '../../web3/web3.service';

@Injectable()
export class StakingFetchService {
  private readonly logger = new Logger(StakingFetchService.name);
  private web3Config: IWeb3Config | undefined;
  private stakingContract: ethers.Contract;

  constructor(
    private readonly web3Service: Web3Service,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly stakingEventsService: StakingEventsService,
  ) {
    this.web3Config = this.configService.get('app.web3Config', {
      infer: true,
    });
    this.stakingContract = this.web3Service.getStakingContract();
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
