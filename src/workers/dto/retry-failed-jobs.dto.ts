import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class RetryFailedJobsDto {
  @ApiProperty({
    description: 'Array of job IDs to retry',
    example: ['job-123', 'job-456', 'job-789'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  jobIds: string[];
}
