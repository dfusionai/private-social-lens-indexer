import {
  BadRequestException,
  // common
  Logger,
  InternalServerErrorException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateRequestRewardDto } from './dto/create-request-reward.dto';
import { UpdateRequestRewardDto } from './dto/update-request-reward.dto';
import { RequestRewardRepository } from './infrastructure/persistence/request-reward.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { RequestReward } from './domain/request-reward';
import { GetTokenEmissionDto } from './dto/get-token-emission-dto';
import { MILLI_SECS_PER_SEC, SECS_PER_DAY } from '../utils/const';
import { RequestRewardEntity } from './infrastructure/persistence/relational/entities/request-reward.entity';

@Injectable()
export class RequestRewardsService {
  private readonly logger = new Logger(RequestRewardsService.name);

  constructor(
    // Dependencies here
    private readonly requestRewardRepository: RequestRewardRepository,
    private readonly dataSource: DataSource,
  ) {}

  async getTokenEmissionMovement(
    query: GetTokenEmissionDto,
  ): Promise<Array<{ reqrewardamount: string; date: string }>> {
    try {
      this.validateDateRange(query);
      const { startDate, endDate } = query;
      const result = await this.dataSource
        .createQueryBuilder(RequestRewardEntity, 'requestRewards')
        .where(
          'requestRewards.blockTimestamp >= :startDate AND requestRewards.blockTimestamp <= :endDate',
          {
            startDate,
            endDate,
          },
        )
        .select([
          'SUM(CAST(requestRewards.rewardAmount AS DECIMAL)) as reqrewardamount',
          "DATE(to_timestamp(requestRewards.blockTimestamp / 1000) AT TIME ZONE 'UTC') as date",
        ])
        .groupBy(
          "DATE(to_timestamp(requestRewards.blockTimestamp / 1000) AT TIME ZONE 'UTC')",
        )
        .orderBy('date', 'ASC')
        .getRawMany();

      const movementData = this.generateCompleteDateRange(query, result);
      this.logger.log(
        `Generated token emission movement data for period ${startDate}-${endDate}: ${movementData.length} days`,
      );
      return movementData;
    } catch (error) {
      this.logger.error('Failed to get token emission movement', error);
      throw new InternalServerErrorException(
        'Failed to retrieve token emission movement data',
      );
    }
  }

  private validateDateRange(query: GetTokenEmissionDto): void {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Start date and end date are required');
    }
    const startDate = Number(query.startDate);
    const endDate = Number(query.endDate);
    if (isNaN(startDate) || isNaN(endDate)) {
      throw new BadRequestException('Invalid date format');
    }
    if (startDate > endDate) {
      throw new BadRequestException(
        'Start date must be before or equal to end date',
      );
    }
    if (startDate < 0 || endDate < 0) {
      throw new BadRequestException('Dates must be non-negative');
    }
  }

  private generateCompleteDateRange(
    query: GetTokenEmissionDto,
    result: Array<{ reqrewardamount: string; date: string }>,
  ): Array<{ reqrewardamount: string; date: string }> {
    const reqRewardAmountByDate: { [key: string]: string } = {};
    result.forEach((row) => {
      const dateKey = new Date(row.date).toISOString().split('T')[0];
      reqRewardAmountByDate[dateKey] = row.reqrewardamount;
    });
    const finalResult: Array<{ reqrewardamount: string; date: string }> = [];
    const start = new Date(Number(query.startDate));
    const end = new Date(Number(query.endDate));
    const daysDiff = Math.ceil(
      (end.getTime() - start.getTime()) / (MILLI_SECS_PER_SEC * SECS_PER_DAY),
    );
    for (let i = 0; i <= daysDiff; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];
      const reqRewardAmount = reqRewardAmountByDate[dateKey] || '0';

      finalResult.push({
        reqrewardamount: reqRewardAmount,
        date: currentDate.toISOString(),
      });
    }
    return finalResult;
  }

  async create(createRequestRewardDto: CreateRequestRewardDto) {
    return this.requestRewardRepository.create(createRequestRewardDto);
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.requestRewardRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: RequestReward['id']) {
    return this.requestRewardRepository.findById(id);
  }

  findByIds(ids: RequestReward['id'][]) {
    return this.requestRewardRepository.findByIds(ids);
  }

  findLatestRequestReward() {
    return this.requestRewardRepository.findLatestRequestReward();
  }

  async update(
    id: RequestReward['id'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateRequestRewardDto: UpdateRequestRewardDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.requestRewardRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
    });
  }

  remove(id: RequestReward['id']) {
    return this.requestRewardRepository.remove(id);
  }
}
