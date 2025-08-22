import { Controller, Post, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JobRecoveryService } from './job-recovery.service';

@ApiTags('Job Recovery')
@Controller({
  path: 'job-recovery',
  version: '1',
})
export class JobRecoveryController {
  private readonly logger = new Logger(JobRecoveryController.name);

  constructor(private readonly jobRecoveryService: JobRecoveryService) {}

  @Post('reset-stuck-jobs')
  @ApiOperation({
    summary: 'Reset stuck jobs to pending',
    description:
      'Resets all jobs with RUNNING or QUEUED status back to PENDING status. This is useful when the application restarts and there are jobs that were interrupted during processing.',
  })
  @ApiOkResponse({
    description: 'Successfully reset stuck jobs to pending status',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Job recovery completed successfully',
        },
        runningReset: {
          type: 'number',
          description: 'Number of running jobs that were reset',
          example: 3,
        },
        queuedReset: {
          type: 'number',
          description: 'Number of queued jobs that were reset',
          example: 2,
        },
        totalStuckJobs: {
          type: 'number',
          description: 'Total number of stuck jobs found before reset',
          example: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during job recovery',
  })
  async resetStuckJobsToPending() {
    this.logger.log('🔄 Job recovery endpoint called');
    const result = await this.jobRecoveryService.resetStuckJobsToPending();
    return {
      message: 'Job recovery completed successfully',
      ...result,
    };
  }
}
