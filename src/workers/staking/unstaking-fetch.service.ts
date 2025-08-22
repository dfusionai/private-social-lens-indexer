import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventLog, ethers } from 'ethers';
import { IWeb3Config } from '../../config/app-config.type';
import { AllConfigType } from '../../config/config.type';
import { UnstakingEventsService } from '../../unstaking-events/unstaking-events.service';
import { formatEtherNumber, formatTimestamp } from '../../utils/helper';
import { BlockRange, IBatch } from '../../utils/types/common.type';
import { Web3Service } from '../../web3/web3.service';

@Injectable()
export class UnstakingFetchService {
  private readonly logger = new Logger(UnstakingFetchService.name);
  private web3Config: IWeb3Config | undefined;
  private provider: ethers.Provider;

  constructor(
    private readonly web3Service: Web3Service,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly unstakingEventsService: UnstakingEventsService,
  ) {
    this.web3Config = this.configService.get('app.web3Config', {
      infer: true,
    });
    this.provider = this.web3Service.getProvider();
  }

  async executeRangeQuery(range: BlockRange): Promise<void> {
    const allEvents: EventLog[] = [];
    try {
      const batches = this.createBatches(range.from, range.to);
      const promises = batches.map((batch) => {
        return this.web3Service.fetchUnstaking(batch.from, batch.to);
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
    if (!Array.isArray(events) || events.length === 0) {
      this.logger.log('No unstaking events found');
      return;
    }

    this.logger.log(`Processing ${events.length} unstaking events`);

    for (const event of events) {
      await this.processUnstakingEvent(event);
    }

    this.logger.log('Finished processing unstaking events');
  }

  async processUnstakingEvent(event: EventLog): Promise<void> {
    const [walletAddress, amount] = event.args;

    if (!walletAddress || !amount) {
      this.logger.warn(
        `Invalid event args for transaction ${event.transactionHash}`,
      );
      return;
    }

    if (!ethers.isAddress(walletAddress)) {
      this.logger.warn(
        `Invalid wallet address in transaction ${event.transactionHash}: ${walletAddress}`,
      );
      return;
    }

    const block = await this.provider.getBlock(event.blockNumber);
    const unstakeTime = block?.timestamp || 0;

    const unstakingEvent = {
      txHash: event.transactionHash,
      walletAddress: walletAddress,
      amount: String(formatEtherNumber(amount)),
      blockNumber: String(event.blockNumber),
      unstakeTime: formatTimestamp(BigInt(unstakeTime)),
    };

    await this.unstakingEventsService.create(unstakingEvent);
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
