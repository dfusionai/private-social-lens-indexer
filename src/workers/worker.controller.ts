import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkerService } from './worker.service';

@ApiTags('Worker')
@Controller({
  path: 'worker',
  version: '1',
})
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}
}
