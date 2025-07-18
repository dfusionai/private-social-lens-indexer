export interface IWeb3Config {
  averageBlockTime: number;
  maxQueryBlockRange: number;
  maxQueryPerSec: number;
  rpcUrl: string;
  stakingContractAddress: string;
  dlpContractAddress: string;
  tokenContractAddress: string;
  initDataDuration: number;
  workerMode: string;
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
};
