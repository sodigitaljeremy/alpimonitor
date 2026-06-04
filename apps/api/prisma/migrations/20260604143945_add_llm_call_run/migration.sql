-- CreateEnum
CREATE TYPE "LlmCallStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "LlmCallRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "LlmCallStatus" NOT NULL,
    "errorKind" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCallRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmCallRun_createdAt_idx" ON "LlmCallRun"("createdAt" DESC);
