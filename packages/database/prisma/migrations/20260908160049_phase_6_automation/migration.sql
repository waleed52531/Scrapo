-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'STALE';
ALTER TYPE "LeadStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "automation_rules" ADD COLUMN     "configuration" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "cron_expression" TEXT,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "last_run_at" TIMESTAMP(3),
ADD COLUMN     "last_run_status" TEXT,
ADD COLUMN     "next_run_at" TIMESTAMP(3),
ADD COLUMN     "schedule_type" TEXT NOT NULL DEFAULT 'CRON',
ADD COLUMN     "skip_next_at" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "device_tokens" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "token" TEXT,
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "email_replies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "rank_breakdown" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "rank_reason" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ranking_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reactivated_at" TIMESTAMP(3),
ADD COLUMN     "stale_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shortlist_items" ADD COLUMN     "rank_reason" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ranking_score" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "suppression_list" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "auto_generate_outreach_drafts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "auto_send_daily_limit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "automation_kill_switch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "automation_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "daily_digest_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "discovery_budget_allocation" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "optimization_settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "outreach_business_days" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
ADD COLUMN     "outreach_business_hours_end" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "outreach_business_hours_start" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "score_jump_threshold" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "send_owner_email_alerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_priorities" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "stale_lead_ttls" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "automation_rule_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "scheduled_period" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "job_id" UUID,
    "previous_run_id" UUID,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_recommendations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "optimization_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_feedback" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "source_performance" JSONB NOT NULL DEFAULT '{}',
    "query_performance" JSONB NOT NULL DEFAULT '{}',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "failures" JSONB NOT NULL DEFAULT '[]',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_runs_workspace_id_status_idx" ON "automation_runs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "automation_runs_workspace_id_scheduled_for_idx" ON "automation_runs"("workspace_id", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_workspace_id_automation_rule_id_scheduled_p_key" ON "automation_runs"("workspace_id", "automation_rule_id", "scheduled_period");

-- CreateIndex
CREATE INDEX "optimization_recommendations_workspace_id_status_idx" ON "optimization_recommendations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "optimization_recommendations_workspace_id_type_idx" ON "optimization_recommendations"("workspace_id", "type");

-- CreateIndex
CREATE INDEX "lead_feedback_workspace_id_lead_id_idx" ON "lead_feedback"("workspace_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_feedback_workspace_id_rating_idx" ON "lead_feedback"("workspace_id", "rating");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_read_at_idx" ON "notifications"("workspace_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_created_at_idx" ON "notifications"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "weekly_reports_workspace_id_generated_at_idx" ON "weekly_reports"("workspace_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_workspace_id_week_start_key" ON "weekly_reports"("workspace_id", "week_start");

-- CreateIndex
CREATE INDEX "automation_rules_workspace_id_enabled_next_run_at_idx" ON "automation_rules"("workspace_id", "enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "leads_workspace_id_ranking_score_idx" ON "leads"("workspace_id", "ranking_score");

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_previous_run_id_fkey" FOREIGN KEY ("previous_run_id") REFERENCES "automation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_recommendations" ADD CONSTRAINT "optimization_recommendations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_feedback" ADD CONSTRAINT "lead_feedback_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_feedback" ADD CONSTRAINT "lead_feedback_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_feedback" ADD CONSTRAINT "lead_feedback_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
