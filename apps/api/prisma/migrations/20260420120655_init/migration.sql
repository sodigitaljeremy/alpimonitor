-- CreateEnum
CREATE TYPE "FlowType" AS ENUM ('NATURAL', 'RESIDUAL', 'DOTATION');

-- CreateEnum
CREATE TYPE "Parameter" AS ENUM ('DISCHARGE', 'WATER_LEVEL', 'TEMPERATURE', 'TURBIDITY');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('ABOVE', 'BELOW');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('THRESHOLD_EXCEEDED', 'STATISTICAL_ANOMALY', 'STATION_OFFLINE');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('INFO', 'VIGILANCE', 'ALERT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateTable
CREATE TABLE "Catchment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "areaKm2" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Catchment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "ofevCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "riverName" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitudeM" DOUBLE PRECISION NOT NULL,
    "catchmentId" TEXT NOT NULL,
    "flowType" "FlowType" NOT NULL DEFAULT 'NATURAL',
    "operatorName" TEXT NOT NULL DEFAULT 'OFEV',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" "Parameter" NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Threshold" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" "Parameter" NOT NULL,
    "vigilanceValue" DOUBLE PRECISION NOT NULL,
    "alertValue" DOUBLE PRECISION NOT NULL,
    "direction" "Direction" NOT NULL DEFAULT 'ABOVE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "level" "AlertLevel" NOT NULL,
    "parameter" "Parameter" NOT NULL,
    "triggerValue" DOUBLE PRECISION NOT NULL,
    "thresholdValue" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Glacier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "altitudeMinM" DOUBLE PRECISION,
    "altitudeMaxM" DOUBLE PRECISION,

    CONSTRAINT "Glacier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationGlacier" (
    "stationId" TEXT NOT NULL,
    "glacierId" TEXT NOT NULL,

    CONSTRAINT "StationGlacier_pkey" PRIMARY KEY ("stationId","glacierId")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL DEFAULT 'Grande Dixence SA',
    "altitudeM" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "annualVolumeM3" DOUBLE PRECISION,
    "stationId" TEXT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThresholdAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" "Parameter" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThresholdAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Catchment_name_key" ON "Catchment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Station_ofevCode_key" ON "Station"("ofevCode");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_stationId_parameter_key" ON "Sensor"("stationId", "parameter");

-- CreateIndex
CREATE INDEX "Measurement_sensorId_recordedAt_idx" ON "Measurement"("sensorId", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_sensorId_recordedAt_key" ON "Measurement"("sensorId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Threshold_stationId_parameter_key" ON "Threshold"("stationId", "parameter");

-- CreateIndex
CREATE INDEX "Alert_stationId_openedAt_idx" ON "Alert"("stationId", "openedAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_closedAt_idx" ON "Alert"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Glacier_name_key" ON "Glacier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_catchmentId_fkey" FOREIGN KEY ("catchmentId") REFERENCES "Catchment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Threshold" ADD CONSTRAINT "Threshold_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationGlacier" ADD CONSTRAINT "StationGlacier_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationGlacier" ADD CONSTRAINT "StationGlacier_glacierId_fkey" FOREIGN KEY ("glacierId") REFERENCES "Glacier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThresholdAudit" ADD CONSTRAINT "ThresholdAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThresholdAudit" ADD CONSTRAINT "ThresholdAudit_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
