-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" "Parameter" NOT NULL,
    "windowFrom" TIMESTAMP(3) NOT NULL,
    "windowTo" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "text" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Insight_stationId_parameter_generatedAt_idx" ON "Insight"("stationId", "parameter", "generatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Insight_stationId_parameter_windowFrom_windowTo_language_in_key" ON "Insight"("stationId", "parameter", "windowFrom", "windowTo", "language", "inputHash");

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
