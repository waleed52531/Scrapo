-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('NOT_ANALYZED', 'QUEUED', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutreachRecommendation" AS ENUM ('AGENCY_PARTNERSHIP', 'ACTIVE_REQUIREMENT', 'MVP_STARTUP', 'EXISTING_APP_FIX', 'FIREBASE_API_SUPPORT', 'APP_STORE_SUPPORT', 'GENERAL_MOBILE_SUPPORT', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "RecommendedChannel" AS ENUM ('EMAIL', 'X_REPLY', 'X_DM', 'REDDIT_REPLY', 'TELEGRAM_REPLY', 'LINKEDIN_CONNECT', 'MANUAL_RESEARCH', 'NONE');

-- CreateEnum
CREATE TYPE "InvalidLeadReason" AS ENUM ('OTHER_FREELANCER', 'SPAM', 'STUDENT_PROJECT', 'PERMANENT_JOB_ONLY', 'IRRELEVANT', 'TUTORIAL', 'JOB_AGGREGATOR', 'COMPETITOR', 'EXPIRED', 'INSUFFICIENT_INFORMATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'LINKEDIN';
ALTER TYPE "LeadSource" ADD VALUE 'OTHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadType" ADD VALUE 'MVP_STARTUP';
ALTER TYPE "LeadType" ADD VALUE 'EXISTING_APP_FIX';
ALTER TYPE "LeadType" ADD VALUE 'FIREBASE_API_SUPPORT';
ALTER TYPE "LeadType" ADD VALUE 'APP_STORE_SUPPORT';
ALTER TYPE "LeadType" ADD VALUE 'GENERAL_MOBILE_SUPPORT';
ALTER TYPE "LeadType" ADD VALUE 'INVALID';
ALTER TYPE "LeadType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "ai_model" TEXT,
ADD COLUMN     "analysis_status" "AnalysisStatus" NOT NULL DEFAULT 'NOT_ANALYZED',
ADD COLUMN     "analyzed_at" TIMESTAMP(3),
ADD COLUMN     "company_analysis_confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "company_analysis_summary" TEXT,
ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "prompt_version" TEXT;

-- AlterTable
ALTER TABLE "lead_scores" ADD COLUMN     "ai_model" TEXT,
ADD COLUMN     "base_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "competitor_probability" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overridden_at" TIMESTAMP(3),
ADD COLUMN     "override_by_user_id" UUID,
ADD COLUMN     "override_original_score" INTEGER,
ADD COLUMN     "override_reason" TEXT,
ADD COLUMN     "override_score" INTEGER,
ADD COLUMN     "penalty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "recommended_channel" "RecommendedChannel",
ADD COLUMN     "recommended_pitch" TEXT,
ADD COLUMN     "spam_probability" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "temperature" "LeadTemperature" NOT NULL DEFAULT 'REVIEW';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "ai_interpretation" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "ai_model" TEXT,
ADD COLUMN     "analysis_confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "analysis_status" "AnalysisStatus" NOT NULL DEFAULT 'NOT_ANALYZED',
ADD COLUMN     "analysis_summary" TEXT,
ADD COLUMN     "evidence" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "invalid_reason" "InvalidLeadReason",
ADD COLUMN     "outreach_recommendation" "OutreachRecommendation",
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "recommended_channel" "RecommendedChannel",
ADD COLUMN     "score_overridden_at" TIMESTAMP(3),
ADD COLUMN     "score_overridden_by_user_id" UUID,
ADD COLUMN     "score_override_original" INTEGER,
ADD COLUMN     "score_override_reason" TEXT,
ADD COLUMN     "score_override_score" INTEGER,
ADD COLUMN     "source_content" TEXT,
ADD COLUMN     "source_url" TEXT,
ADD COLUMN     "unknowns" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT,
    "success" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost" DECIMAL(12,6),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_workspace_id_feature_created_at_idx" ON "ai_usage_logs"("workspace_id", "feature", "created_at");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
