import { registerAs } from '@nestjs/config';
import { AppConfig } from './app-config.type';
import validateConfig from '.././utils/validate-config';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { WORKER_MODE } from '../utils/const';
enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  APP_PORT: number;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_DOMAIN: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_DOMAIN: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE: string;

  @IsString()
  @IsOptional()
  STAKING_CONTRACT_ADDRESS: string;

  @IsString()
  @IsOptional()
  DLP_CONTRACT_ADDRESS: string;

  @IsString()
  @IsOptional()
  TOKEN_CONTRACT_ADDRESS: string;

  @IsString()
  @IsOptional()
  AVERAGE_BLOCK_TIME: string;

  @IsString()
  @IsOptional()
  MAX_QUERY_BLOCK_RANGE: string;

  @IsString()
  @IsOptional()
  MAX_REQUESTS_PER_SEC: string;

  @IsString()
  @IsOptional()
  RPC_URL: string;

  @IsString()
  @IsOptional()
  WORKER_MODE: string;
}

export default registerAs<AppConfig>('app', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'app',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN ?? 'http://localhost',
    port: process.env.APP_PORT
      ? parseInt(process.env.APP_PORT, 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000,
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'en',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
    web3Config: {
      averageBlockTime: process.env.AVERAGE_BLOCK_TIME
        ? parseInt(process.env.AVERAGE_BLOCK_TIME, 10)
        : 6,
      maxQueryBlockRange: process.env.MAX_QUERY_BLOCK_RANGE
        ? parseInt(process.env.MAX_QUERY_BLOCK_RANGE, 10)
        : 10000,
      maxQueryPerSec: process.env.MAX_REQUESTS_PER_SEC
        ? parseInt(process.env.MAX_REQUESTS_PER_SEC, 10)
        : 100,
      rpcUrl: process.env.RPC_URL || '',
      stakingContractAddress: process.env.STAKING_CONTRACT_ADDRESS || '',
      dlpContractAddress: process.env.DLP_CONTRACT_ADDRESS || '',
      tokenContractAddress: process.env.TOKEN_CONTRACT_ADDRESS || '',
      initDataDuration: process.env.INIT_DATA_DURATION
        ? Number(process.env.INIT_DATA_DURATION)
        : 12,
      workerMode: process.env.WORKER_MODE || WORKER_MODE.CRAWL,
    },
    workerConfig: {
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: process.env.REDIS_PORT
        ? parseInt(process.env.REDIS_PORT, 10)
        : 6379,
    },
  };
});
