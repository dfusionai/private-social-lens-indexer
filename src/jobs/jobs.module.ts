import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobEntity } from './infrastructure/persistence/relational/entities/job.entity';
import { JobRepository } from './infrastructure/persistence/relational/repositories/job.repository';

@Module({
  imports: [TypeOrmModule.forFeature([JobEntity])],
  controllers: [JobsController],
  providers: [JobsService, JobRepository],
  exports: [JobsService, JobRepository],
})
export class JobsModule {}
