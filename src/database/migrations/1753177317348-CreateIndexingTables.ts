import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIndexingTables1753177317348 implements MigrationInterface {
  name = 'CreateIndexingTables1753177317348';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."checkpoint_querytype_enum" AS ENUM('REQUEST_REWARD', 'STAKING', 'UNSTAKING')`,
    );

    await queryRunner.query(
      `CREATE TABLE "unstaking_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "txHash" character varying NOT NULL, "walletAddress" character varying NOT NULL, "amount" numeric NOT NULL, "blockNumber" numeric NOT NULL, "unstakeTime" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b65e628ee4b7ebf6b488f1a6ea4" UNIQUE ("txHash"), CONSTRAINT "PK_9accc685bbef2a834f0853102a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staking_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "txHash" character varying NOT NULL, "walletAddress" character varying NOT NULL, "amount" numeric NOT NULL, "duration" numeric NOT NULL, "hasWithdrawal" boolean NOT NULL, "withdrawalTime" numeric, "startTime" numeric NOT NULL, "blockNumber" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_edd6ea058c5ea49d14741bdf053" UNIQUE ("txHash"), CONSTRAINT "PK_3bbbf4cf97430c2695c4b6095a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "request_reward" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blockNumber" numeric NOT NULL, "contributorAddress" character varying NOT NULL, "rewardAmount" numeric NOT NULL, "fileId" numeric NOT NULL, "proofIndex" numeric NOT NULL, "txHash" character varying NOT NULL, "blockTimestamp" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_39e5fa6d7c7a51f0b8ee3660a9b" UNIQUE ("txHash"), CONSTRAINT "PK_022cfb1878020898b239cbcdbd0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "checkpoint" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "toBlockNumber" numeric NOT NULL, "fromBlockNumber" numeric NOT NULL, "queryType" "public"."checkpoint_querytype_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fea86db187949398f8b614f730a" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE "public"."checkpoint_querytype_enum"`);

    await queryRunner.query(`DROP TABLE "checkpoint"`);
    await queryRunner.query(`DROP TABLE "request_reward"`);
    await queryRunner.query(`DROP TABLE "staking_events"`);
    await queryRunner.query(`DROP TABLE "unstaking_events"`);
  }
}
