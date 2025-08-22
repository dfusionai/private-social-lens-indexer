import { ApiProperty } from '@nestjs/swagger';
import { JobEventType } from '../../jobs/domain/job';

export class Checkpoint {
  @ApiProperty({
    type: String,
  })
  id: string;

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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
