export interface IWeb3Config {
  maxQueryBlockRange: number;
  maxQueryPerSec: number;
  rpcUrl: string;
  stakingContractAddress: string;
  dlpContractAddress: string;
  tokenContractAddress: string;
  startBlock?: number;
}

export interface IWorkerConfig {
  redisHost: string;
  redisPort: number;
}

export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  web3Config: IWeb3Config;
  workerConfig: IWorkerConfig;
  i18nWatchFiles: boolean;
};
