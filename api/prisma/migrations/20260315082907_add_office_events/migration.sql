-- CreateEnum
CREATE TYPE "OfficeEventType" AS ENUM ('OFFICE_CLOSED', 'TEAM_SOCIAL', 'IMPORTANT_EVENT');

-- CreateTable
CREATE TABLE "office_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_type" "OfficeEventType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "allow_time_entry" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "office_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "office_events_start_date_idx" ON "office_events"("start_date");

-- CreateIndex
CREATE INDEX "office_events_end_date_idx" ON "office_events"("end_date");

-- CreateIndex
CREATE INDEX "office_events_event_type_idx" ON "office_events"("event_type");
