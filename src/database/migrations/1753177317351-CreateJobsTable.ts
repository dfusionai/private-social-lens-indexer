import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobsTable1753177317351 implements MigrationInterface {
  name = 'CreateJobsTable1753177317351';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."job_type_enum" AS ENUM('CRAWL_CHUNK', 'LISTEN_CHUNK')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."job_status_enum" AS ENUM('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."job_event_type_enum" AS ENUM('REQUEST_REWARD', 'STAKING', 'UNSTAKING')
    `);

    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."job_type_enum" NOT NULL,
        "eventType" "public"."job_event_type_enum" NOT NULL,
        "fromBlock" numeric NOT NULL,
        "toBlock" numeric NOT NULL,
        "contractAddress" character varying,
        "eventNames" text array,
        "status" "public"."job_status_enum" NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT '0',
        "maxAttempts" integer NOT NULL DEFAULT '3',
        "lastAttemptAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_jobs_status" ON "jobs" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_jobs_type" ON "jobs" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_jobs_event_type" ON "jobs" ("eventType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_jobs_created_at" ON "jobs" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_jobs_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_jobs_event_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_jobs_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_jobs_status"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TYPE "public"."job_event_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."job_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."job_type_enum"`);
  }
}
