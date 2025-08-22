import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class CrawlBlockRangeDto {
  @ApiProperty({
    description: 'Starting block number to crawl from',
    example: 2820852,
    type: Number,
  })
  @IsNumber()
  @IsNotEmpty()
  fromBlock: number;

  @ApiProperty({
    description: 'Ending block number to crawl to',
    example: 2830852,
    type: Number,
  })
  @IsNumber()
  @IsNotEmpty()
  toBlock: number;
}
