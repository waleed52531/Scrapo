-- CreateEnum
CREATE TYPE "OpportunityUrgency" AS ENUM ('IMMEDIATE', 'THIS_WEEK', 'THIS_MONTH', 'FLEXIBLE', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "ActionStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationStatus" ADD VALUE 'CONFIGURED';
ALTER TYPE "IntegrationStatus" ADD VALUE 'APPROVAL_REQUIRED';
ALTER TYPE "IntegrationStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "IntegrationStatus" ADD VALUE 'DISABLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvalidLeadReason" ADD VALUE 'SELF_PROMOTION';
ALTER TYPE "InvalidLeadReason" ADD VALUE 'BOT';
ALTER TYPE "InvalidLeadReason" ADD VALUE 'NEWS';
ALTER TYPE "InvalidLeadReason" ADD VALUE 'DUPLICATE';

-- AlterEnum
ALTER TYPE "LeadType" ADD VALUE 'PERMANENT_JOB';

-- AlterTable
ALTER TABLE "action_queue" ADD COLUMN     "action_type" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "platform" "LeadSource",
ADD COLUMN     "profile_url" TEXT,
ADD COLUMN     "source_url" TEXT,
ADD COLUMN     "stale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggested_text" TEXT;

-- AlterTable
ALTER TABLE "discovery_query_runs" ADD COLUMN     "duplicate_results" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enriched_results" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manual_actions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prequalified_results" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relevant_results" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scored_results" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lead_signals" ADD COLUMN     "author_external_id" TEXT,
ADD COLUMN     "author_type" TEXT,
ADD COLUMN     "author_type_confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "opportunity_urgency" "OpportunityUrgency" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "profile_url" TEXT,
ADD COLUMN     "signal_quality_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "social_pre_qualification_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "buyer_intent_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opportunity_urgency" "OpportunityUrgency" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "primary_signal_id" UUID,
ADD COLUMN     "self_promotion_probability" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "social_pre_qualification_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "social_spam_probability" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "raw_leads" ADD COLUMN     "author_external_id" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "engagement" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "profile_url" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "search_queries" ADD COLUMN     "manual_actions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prequalified_results" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relevant_results" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "social_profiles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "contact_id" UUID,
    "platform" "LeadSource" NOT NULL,
    "external_id" TEXT,
    "username" TEXT,
    "display_name" TEXT,
    "profile_url" TEXT,
    "author_type" TEXT,
    "author_type_confidence" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_sources" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_profiles_workspace_id_platform_username_idx" ON "social_profiles"("workspace_id", "platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_workspace_id_platform_external_id_key" ON "social_profiles"("workspace_id", "platform", "external_id");

-- CreateIndex
CREATE INDEX "telegram_sources_workspace_id_enabled_idx" ON "telegram_sources"("workspace_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_sources_workspace_id_external_id_key" ON "telegram_sources"("workspace_id", "external_id");

-- CreateIndex
CREATE INDEX "action_queue_workspace_id_platform_idx" ON "action_queue"("workspace_id", "platform");

-- CreateIndex
CREATE INDEX "action_queue_workspace_id_expires_at_idx" ON "action_queue"("workspace_id", "expires_at");

-- CreateIndex
CREATE INDEX "leads_workspace_id_primary_source_idx" ON "leads"("workspace_id", "primary_source");

-- AddForeignKey
ALTER TABLE "action_queue" ADD CONSTRAINT "action_queue_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_sources" ADD CONSTRAINT "telegram_sources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
