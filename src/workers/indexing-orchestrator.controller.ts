import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { JobType } from '../jobs/domain/job';
import { CrawlBlockRangeDto } from './dto';
import { IndexingOrchestratorService } from './indexing-orchestrator.service';

@ApiTags('Orchestrator Indexing')
@Controller({
  path: 'indexing',
  version: '1',
})
export class IndexingOrchestratorController {
  constructor(
    private readonly indexingOrchestratorService: IndexingOrchestratorService,
  ) {}

  @Post('crawl')
  @ApiBody({
    type: CrawlBlockRangeDto,
    description: 'Block range to crawl',
    examples: {
      example: {
        summary: 'Crawl blocks 1000000 to 1010000',
        description: 'Crawl a range of 10,000 blocks',
        value: {
          fromBlock: 1000000,
          toBlock: 1010000,
        },
      },
    },
  })
  async crawlBlockRange(@Body() dto: CrawlBlockRangeDto): Promise<{
    message: string;
    fromBlock: number;
    toBlock: number;
    jobIds: string[];
  }> {
    const jobIds = await this.indexingOrchestratorService.crawlBlockRange(
      dto.fromBlock,
      dto.toBlock,
      JobType.CRAWL_CHUNK,
    );

    return {
      message: 'CRAWL initiated successfully',
      fromBlock: dto.fromBlock,
      toBlock: dto.toBlock,
      jobIds,
    };
  }
}
