-- CreateEnum
CREATE TYPE "SourcingStatus" AS ENUM ('CONFIRMED', 'ILLUSTRATIVE');

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "sourcingStatus" "SourcingStatus" NOT NULL DEFAULT 'ILLUSTRATIVE';
