import { ApiProperty } from '@nestjs/swagger';
import { JobEventType } from '../../jobs/domain/job';

export class CreateCheckpointDto {
  @ApiProperty({
    type: String,
  })
  toBlockNumber: string;

  @ApiProperty({
    type: String,
  })
  fromBlockNumber: string;

  @ApiProperty({
    type: String,
  })
  queryType: JobEventType;
}
