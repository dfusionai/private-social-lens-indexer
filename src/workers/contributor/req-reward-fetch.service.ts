import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, EventLog } from 'ethers';
import { IWeb3Config } from '../../config/app-config.type';
import { AllConfigType } from '../../config/config.type';
import { CreateRequestRewardDto } from '../../request-rewards/dto/create-request-reward.dto';
import { RequestRewardsService } from '../../request-rewards/request-rewards.service';
import { formatEtherNumber, formatTimestamp } from '../../utils/helper';
import { BlockRange, IBatch } from '../../utils/types/common.type';
import { Web3Service } from '../../web3/web3.service';

@Injectable()
export class ReqRewardFetchService {
  private provider: ethers.Provider;
  private logger = new Logger(ReqRewardFetchService.name);
  private web3Config: IWeb3Config | undefined;

  constructor(
    private readonly web3Service: Web3Service,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly requestRewardService: RequestRewardsService,
  ) {
    this.provider = web3Service.getProvider();
    this.web3Config = this.configService.get('app.web3Config', {
      infer: true,
    });
  }

  async executeRangeQuery(range: BlockRange): Promise<void> {
    try {
      const allEvents: EventLog[] = [];
      const batches = this.createBatches(range.from, range.to);
      const promises = batches.map((batch) => {
        return this.web3Service.fetchReqReward(batch.from, batch.to);
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

  async logEvents(events: EventLog[]): Promise<void> {
    try {
      if (!Array.isArray(events) || events.length === 0) {
        this.logger.log('No request reward events found');
        return;
      }

      this.logger.log(`Processing ${events.length} request reward events`);

      for (const event of events) {
        await this.processRequestRewardEvent(event);
      }

      this.logger.log('Finished processing request reward events');
    } catch (error) {
      this.logger.error('Failed to log events', error);
      throw error;
    }
  }

  async processRequestRewardEvent(event: EventLog): Promise<void> {
    try {
      const [contributorAddress, fileId, proofIndex, rewardAmount] = event.args;

      if (!contributorAddress || !fileId || !proofIndex || !rewardAmount) {
        this.logger.warn(
          `Invalid event args for transaction ${event.transactionHash}`,
        );
        return;
      }

      const block = await this.provider.getBlock(event.blockNumber);
      const timestamp = block?.timestamp || 0;

      const requestRewardEvent: CreateRequestRewardDto = {
        txHash: event.transactionHash,
        contributorAddress: contributorAddress,
        fileId: String(Number(fileId)),
        proofIndex: String(Number(proofIndex)),
        rewardAmount: formatEtherNumber(rewardAmount),
        blockNumber: String(event.blockNumber),
        blockTimestamp: formatTimestamp(BigInt(timestamp)),
      };

      await this.requestRewardService.create(requestRewardEvent);
    } catch (error) {
      this.logger.error(
        `Failed to process request reward event ${event.transactionHash}`,
        error,
      );
      throw error;
    }
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
