-- AlterTable: add unique constraint on Withdrawal.name so seed upserts
-- can use `name` as the unique key (no natural id from an upstream source).
CREATE UNIQUE INDEX "Withdrawal_name_key" ON "Withdrawal"("name");
