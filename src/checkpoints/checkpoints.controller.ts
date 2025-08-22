import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckpointsService } from './checkpoints.service';

@ApiTags('Checkpoints')
@Controller({
  path: 'checkpoints',
  version: '1',
})
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @Get('oldest-processed-block')
  @ApiOperation({
    summary: 'Get oldest processed block number',
    description:
      'Returns the oldest block number that has been processed across all event types.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved oldest processed block number',
    schema: {
      type: 'object',
      properties: {
        oldestProcessedBlockNumber: {
          type: 'number',
          nullable: true,
          description: 'The oldest processed block number',
          example: 1000,
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getOldestProcessedBlockNumber() {
    const oldestBlock =
      await this.checkpointsService.getOldestProcessedBlockNumber();
    return {
      oldestProcessedBlockNumber: oldestBlock,
    };
  }

  @Get('latest-processed-block')
  @ApiOperation({
    summary: 'Get latest processed block number',
    description:
      'Returns the latest block number that has been processed across all event types.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved latest processed block number',
    schema: {
      type: 'object',
      properties: {
        latestProcessedBlockNumber: {
          type: 'number',
          nullable: true,
          description: 'The latest processed block number',
          example: 5000,
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getLatestProcessedBlockNumber() {
    const latestBlock =
      await this.checkpointsService.getLatestProcessedBlockNumber();
    return {
      latestProcessedBlockNumber: latestBlock,
    };
  }
}
