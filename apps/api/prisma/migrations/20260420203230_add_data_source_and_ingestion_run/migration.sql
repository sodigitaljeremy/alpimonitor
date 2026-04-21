-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('LIVE', 'RESEARCH', 'SEED');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateEnum
CREATE TYPE "IngestionSourceKind" AS ENUM ('LINDAS_HYDRO');

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'LIVE';

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "source" "IngestionSourceKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "IngestionStatus" NOT NULL,
    "stationsSeenCount" INTEGER NOT NULL DEFAULT 0,
    "measurementsCreatedCount" INTEGER NOT NULL DEFAULT 0,
    "measurementsSkippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "httpStatus" INTEGER,
    "payloadBytes" INTEGER,
    "payloadHash" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionRun_source_startedAt_idx" ON "IngestionRun"("source", "startedAt" DESC);
