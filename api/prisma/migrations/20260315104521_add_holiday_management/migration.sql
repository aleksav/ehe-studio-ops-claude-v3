-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('EMPLOYEE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "HolidayDayType" AS ENUM ('FULL', 'AM', 'PM');

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "member_type" "MemberType" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE "planned_holidays" (
    "id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_type" "HolidayDayType" NOT NULL DEFAULT 'FULL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planned_holidays_team_member_id_idx" ON "planned_holidays"("team_member_id");

-- CreateIndex
CREATE INDEX "planned_holidays_date_idx" ON "planned_holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "planned_holidays_team_member_id_date_key" ON "planned_holidays"("team_member_id", "date");

-- AddForeignKey
ALTER TABLE "planned_holidays" ADD CONSTRAINT "planned_holidays_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
