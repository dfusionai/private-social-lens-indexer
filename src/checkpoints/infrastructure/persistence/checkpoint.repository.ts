import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Checkpoint } from '../../domain/checkpoint';
export abstract class CheckpointRepository {
  abstract create(
    data: Omit<Checkpoint, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Checkpoint>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Checkpoint[]>;

  abstract findById(id: Checkpoint['id']): Promise<NullableType<Checkpoint>>;

  abstract findByIds(ids: Checkpoint['id'][]): Promise<Checkpoint[]>;

  abstract findLatestCheckpoint(): Promise<NullableType<Checkpoint>>;

  abstract findOldestCheckpoint(): Promise<NullableType<Checkpoint>>;

  abstract update(
    id: Checkpoint['id'],
    payload: DeepPartial<Checkpoint>,
  ): Promise<Checkpoint | null>;

  abstract remove(id: Checkpoint['id']): Promise<void>;
}
