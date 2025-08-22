import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ApiBody, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Jobs')
@Controller({
  path: 'jobs',
  version: '1',
})
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('statistics')
  async getStatistics() {
    return this.jobsService.getStatistics();
  }

  @Get('pending')
  async getPendingJobs(@Query('limit') limit?: number) {
    return this.jobsService.getPendingJobs(limit);
  }

  @Get('failed')
  async getFailedJobs(@Query('limit') limit?: number) {
    return this.jobsService.getFailedJobs(limit);
  }

  @Get('queue')
  async getQueueJobs(@Query('limit') limit?: number) {
    return this.jobsService.getQueueJobs(limit);
  }

  @Get('completed')
  async getCompletedJobs(@Query('limit') limit?: number) {
    return this.jobsService.getCompletedJobs(limit);
  }

  @Get('running')
  async getRunningJobs(@Query('limit') limit?: number) {
    return this.jobsService.getRunningJobs(limit);
  }

  @Get(':id')
  async getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

  @Post('retry-by-ids')
  @ApiOperation({
    summary: 'Retry specific failed jobs by IDs',
    description:
      'Retries specific failed jobs by their IDs. Only jobs in FAILED status that can be retried will be processed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        jobIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of job IDs to retry',
          example: ['job-123', 'job-456', 'job-789'],
        },
      },
      required: ['jobIds'],
    },
    examples: {
      example: {
        summary: 'Retry specific failed jobs',
        description: 'Retry jobs with IDs job-123, job-456, job-789',
        value: {
          jobIds: ['job-123', 'job-456', 'job-789'],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Successfully processed retry request',
    schema: {
      type: 'object',
      properties: {
        retried: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job IDs that were successfully retried',
          example: ['job-123', 'job-456'],
        },
        skipped: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job IDs that were skipped (not failed or cannot retry)',
          example: ['job-789'],
        },
        notFound: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job IDs that were not found',
          example: ['job-999'],
        },
        message: {
          type: 'string',
          description: 'Summary message of the retry operation',
          example:
            'Retry operation completed. Retried: 2, Skipped: 1, Not Found: 1',
        },
      },
    },
  })
  async retryJobsByIds(@Body() body: { jobIds: string[] }) {
    return this.jobsService.retryJobsByIds(body.jobIds);
  }
}
