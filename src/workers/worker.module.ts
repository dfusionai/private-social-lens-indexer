import {
  // common
  Module,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StakingFetchService } from './staking/staking-fetch.service';
import { Web3Service } from '../web3/web3.service';
import { StakingEventsModule } from '../staking-events/staking-events.module';
import { UnstakingEventsModule } from '../unstaking-events/unstaking-events.module';
import { UnstakingFetchService } from './staking/unstaking-fetch.service';
import { WorkerService } from './worker.service';
import { ReqRewardFetchService } from './contributor/req-reward-fetch.service';
import { RequestRewardsModule } from '../request-rewards/request-rewards.module';
import { CheckpointsModule } from '../checkpoints/checkpoints.module';
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 1000,
        maxRetriesPerRequest: 3,
      },
    }),
    BullModule.registerQueue({
      name: 'blockchain-index-event',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
      },
    }),
    StakingEventsModule,
    UnstakingEventsModule,
    RequestRewardsModule,
    CheckpointsModule,
  ],
  providers: [
    Web3Service,
    StakingFetchService,
    UnstakingFetchService,
    ReqRewardFetchService,
    WorkerService,
  ],
  exports: [WorkerService],
})
export class WorkerModule {}
