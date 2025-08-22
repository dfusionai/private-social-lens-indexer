import { Injectable } from '@nestjs/common';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { CheckpointRepository } from './infrastructure/persistence/checkpoint.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Checkpoint } from './domain/checkpoint';
import { JobEventType } from '../jobs/domain/job';

@Injectable()
export class CheckpointsService {
  constructor(private readonly checkpointRepository: CheckpointRepository) {}

  async create(createCheckpointDto: CreateCheckpointDto) {
    return this.checkpointRepository.create(createCheckpointDto);
  }

  async findLatestCheckpoint() {
    return this.checkpointRepository.findLatestCheckpoint();
  }

  async findOldestCheckpoint() {
    return this.checkpointRepository.findOldestCheckpoint();
  }

  async getOldestProcessedBlockNumber(): Promise<number | null> {
    const oldestCheckpoint = await this.findOldestCheckpoint();
    return oldestCheckpoint ? Number(oldestCheckpoint.fromBlockNumber) : null;
  }

  async getLatestProcessedBlockNumber(): Promise<number | null> {
    const latestCheckpoint = await this.findLatestCheckpoint();
    return latestCheckpoint ? Number(latestCheckpoint.toBlockNumber) : null;
  }

  async saveLatestCheckpoint(
    toBlock: number,
    fromBlock: number,
    queryType: JobEventType,
  ) {
    try {
      await this.create({
        toBlockNumber: String(toBlock),
        fromBlockNumber: String(fromBlock),
        queryType: queryType,
      });
    } catch (error) {
      throw error;
    }
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.checkpointRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Checkpoint['id']) {
    return this.checkpointRepository.findById(id);
  }

  findByIds(ids: Checkpoint['id'][]) {
    return this.checkpointRepository.findByIds(ids);
  }

  async update(id: Checkpoint['id'], updateCheckpointDto: UpdateCheckpointDto) {
    return this.checkpointRepository.update(id, updateCheckpointDto);
  }

  remove(id: Checkpoint['id']) {
    return this.checkpointRepository.remove(id);
  }
}
