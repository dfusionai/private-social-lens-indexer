# Blockchain Indexing Architecture

This document describes the blockchain indexing architecture that implements a job-based system for reliable event processing with BullMQ integration.

## Overview

The indexing system provides two modes of operation:
- **CRAWL**: Processes a specific block range by breaking it into chunks
- **LISTEN**: Continuously monitors for new blocks and processes them automatically

**Key Feature**: The system creates **separate jobs for each entity type** (staking, unstaking, request rewards), allowing for independent processing and better scalability.

## Architecture Components

### 1. Database Schema

#### `jobs` Table
- Stores jobs for each entity type using a job-based pattern
- Job types: `CRAWL_CHUNK`, `LISTEN_CHUNK`
- Event types: `STAKING`, `UNSTAKING`, `REQUEST_REWARD`
- Status tracking: PENDING → QUEUED → COMPLETED/FAILED
- Each block range creates 3 separate jobs (one for each entity type)

#### `checkpoint` Table
- Tracks the highest block processed for each event type
- Used by LISTEN mode to determine new blocks
- Event types: `REQUEST_REWARD`, `STAKING`, `UNSTAKING` (same as JobEventType)

#### Business Tables
- `staking_events`: Stores staking events
- `unstaking_events`: Stores unstaking events  
- `request_reward`: Stores request reward events

### 2. Core Services

#### `IndexingOrchestratorService`
- Orchestrates the entire indexing process
- Implements CRAWL and LISTEN modes
- **Creates separate jobs for each entity type**
- Manages job creation and BullMQ queue integration
- Handles retries for failed jobs
- Provides statistics and monitoring

#### `IndexingOrchestratorController`
- REST API endpoints for indexing operations
- **CRAWL Mode**: `POST /v1/indexing/crawl` - Process specific block ranges
- **Statistics**: `GET /v1/indexing/statistics` - Get indexing statistics
- **Failed Jobs**: `GET /v1/indexing/failed-jobs` - Get all failed jobs
- **Manual Retry**: `POST /v1/indexing/retry-failed-jobs` - Retry specific failed jobs

#### `WorkerService`
- Processes jobs from BullMQ queue (`blockchain-index-event`)
- **Routes jobs to appropriate entity-specific services**
- Handles job lifecycle management
- Integrates with existing fetch services

#### Entity-Specific Fetch Services
- `StakingFetchService`: Processes staking events
- `UnstakingFetchService`: Processes unstaking events
- `ReqRewardFetchService`: Processes request reward events

### 3. Job-Based Architecture

The system creates **separate jobs for each entity type**:

```
Block Range → 3 Separate Jobs
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
  Staking Job  Unstaking Job  Request Rewards Job
        ↓           ↓           ↓
  StakingFetchService  UnstakingFetchService  ReqRewardFetchService
        ↓           ↓           ↓
  staking_events   unstaking_events  request_reward
        table            table            table
```

### 4. Job Processing Flow

1. **Job Creation**: Separate jobs created for each entity type
2. **Queue Processing**: BullMQ processes jobs with configurable concurrency
3. **Entity Routing**: Worker routes jobs to entity-specific services
4. **Business Logic**: Each service processes its specific entity type
5. **Retry Logic**: Failed jobs are automatically retried with exponential backoff

## API Endpoints

### CRAWL Mode
```bash
POST /v1/indexing/crawl
{
  "fromBlock": 1000000,
  "toBlock": 1010000
}
```

This will:
1. Break the range into chunks (configurable via `ONE_DAY_BLOCK_RANGE`)
2. **Create 3 separate jobs for each chunk** (staking, unstaking, request rewards)
3. Process each job independently through BullMQ
4. Store results in existing business tables

### Statistics
```bash
GET /v1/indexing/statistics
```

Returns:
```json
{
  "pending": 15,
  "queued": 5,
  "completed": 100,
  "failed": 2,
  "totalEvents": 0,
  "lastIndexedBlock": 5000,
  "oldestIndexBlock": 1000
}
```

### Failed Jobs Management
```bash
# Get failed jobs
GET /v1/indexing/failed-jobs?limit=50

# Retry specific failed jobs
POST /v1/indexing/retry-failed-jobs
{
  "jobIds": ["job-123", "job-456", "job-789"]
}
```

Response:
```json
{
  "retried": ["job-123", "job-456"],
  "skipped": ["job-789"],
  "notFound": ["job-999"],
  "message": "Retry operation completed"
}
```

### Job Recovery Management
```bash
# Reset stuck jobs (RUNNING and QUEUED) to PENDING
POST /v1/job-recovery/reset-stuck-jobs
```

Response:
```json
{
  "message": "Job recovery completed successfully",
  "runningReset": 3,
  "queuedReset": 2,
  "totalStuckJobs": 5
}
```

**Note**: This is useful when the application restarts and there are jobs that were interrupted during processing.

## Configuration

### Environment Variables
- `START_BLOCK`: Starting block for indexing
- `END_BLOCK`: Ending block for indexing (optional)
- `MAX_QUERY_BLOCK_RANGE`: Size of block chunks (default: 10000)
- `REDIS_HOST`/`REDIS_PORT`: Redis configuration for BullMQ
- `STAKING_CONTRACT_ADDRESS`: Staking contract address
- `DLP_CONTRACT_ADDRESS`: DLP contract address

### BullMQ Configuration
- **Queue Name**: `blockchain-index-event`
- **Concurrency**: 10 workers
- **Lock Duration**: 180 seconds
- **Max Stalled Count**: 3
- **Job Cleanup**: 100 completed, 50 failed

### Cron Jobs
- **LISTEN Mode**: Every minute (checks for new blocks)
- **Retry Failed Jobs**: Every 5 minutes (automatic retry of old failed jobs)

## Job Types and Status

### Job Types
- `CRAWL_CHUNK`: Process historical block ranges
- `LISTEN_CHUNK`: Process new blocks in real-time

### Event Types (JobEventType)
- `STAKING`: Staking events
- `UNSTAKING`: Unstaking events
- `REQUEST_REWARD`: Request reward events

**Note**: Event types are consistently used across both jobs and checkpoints for better maintainability.

### Job Status
- `PENDING`: Job created, waiting to be queued
- `QUEUED`: Job in BullMQ queue, waiting to be processed
- `RUNNING`: Job currently being processed by a worker
- `COMPLETED`: Job processed successfully
- `FAILED`: Job failed (can be retried manually or automatically)

## Data Flow

```
Block Range → 3 Separate Jobs → BullMQ Queue → Worker Service
                                                      ↓
                                    ┌─────────────────┼─────────────────┐
                                    ↓                 ↓                 ↓
                              StakingFetchService  UnstakingFetchService  ReqRewardFetchService
                                    ↓                 ↓                 ↓
                              staking_events   unstaking_events  request_reward
                                    table            table            table
```

## Benefits

1. **🛡️ Reliability**: BullMQ ensures no job loss with persistence and retry mechanisms
2. **⚡ Scalability**: Independent processing of each entity type with configurable concurrency
3. **📊 Monitoring**: Detailed statistics and failed job management
4. **🔄 Flexibility**: Supports both batch (CRAWL) and real-time (LISTEN) processing
5. **🛡️ Compatibility**: Maintains existing business logic and data structures
6. **🤖 Modularity**: Each entity type has its own dedicated fetch service
7. **🚀 Performance**: Parallel processing of different entity types
8. **🔧 Manual Control**: Ability to manually retry failed jobs

## Error Handling

- **RPC Errors**: Automatic retry with exponential backoff
- **Database Errors**: Jobs marked as failed and retried later
- **Network Issues**: Graceful degradation and recovery
- **Business Logic Errors**: Proper error handling and logging per entity type
- **Manual Intervention**: Failed jobs can be manually retried via API

## Performance Considerations

- **Chunk Size**: Configurable via `ONE_DAY_BLOCK_RANGE` (default: 10000 blocks)
- **Concurrency**: Adjustable worker concurrency (default: 10)
- **Batch Processing**: Events inserted in batches for efficiency
- **Indexing**: Database indexes for fast queries
- **Modular Processing**: Each entity type processed independently

## Testing

The system includes comprehensive integration tests to ensure:
- ✅ Business logic integration works correctly
- ✅ All events are processed properly
- ✅ Error handling works as expected
- ✅ Job lifecycle management functions correctly
- ✅ Entity-specific services work independently

Run tests with:
```bash
npm test -- indexing.integration.spec.ts
```

## Migration from Legacy System

The new system maintains **full compatibility** with the existing business logic:

### ✅ What Works Unchanged
1. **Existing Services**: Staking, unstaking, and request reward services continue to work
2. **Database Tables**: All existing tables (`staking_events`, `unstaking_events`, `request_reward`) remain unchanged
3. **Business Logic**: All existing business logic and data processing remains the same
4. **Checkpoints**: Existing checkpoint system for tracking progress

### 🔄 What's New
1. **Job-Based Architecture**: Separate jobs for each entity type
2. **Independent Processing**: Each entity type can be processed independently
3. **Better Scalability**: Parallel processing of different entity types
4. **Improved Monitoring**: Statistics and failed job management
5. **BullMQ Integration**: Reliable job processing with no data loss
6. **Manual Retry**: Ability to manually retry failed jobs

### 📊 Data Flow
```
Block Range → 3 Separate Jobs → BullMQ Queue → 3 Separate Services
                                                      ↓
                                    ┌─────────────────┼─────────────────┐
                                    ↓                 ↓                 ↓
                              Staking Events   Unstaking Events  Request Rewards
                                    ↓                 ↓                 ↓
                              staking_events   unstaking_events  request_reward
                                    table            table            table
``` 