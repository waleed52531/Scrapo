-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE 'LIKELY_VALID';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProcessingStatus" ADD VALUE 'DISCOVERED';
ALTER TYPE "ProcessingStatus" ADD VALUE 'FILTERING';
ALTER TYPE "ProcessingStatus" ADD VALUE 'COMPANY_CREATED';
ALTER TYPE "ProcessingStatus" ADD VALUE 'ANALYZING';
ALTER TYPE "ProcessingStatus" ADD VALUE 'ENRICHING';
ALTER TYPE "ProcessingStatus" ADD VALUE 'SCORED';
ALTER TYPE "ProcessingStatus" ADD VALUE 'QUALIFIED';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "discovery_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duplicate_confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enrichment_status" TEXT,
ADD COLUMN     "last_discovered_at" TIMESTAMP(3),
ADD COLUMN     "mobile_outsourcing_opportunity_confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pre_qualification_score" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "source" TEXT,
ADD COLUMN     "verification_provider" TEXT,
ADD COLUMN     "verification_result" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lead_signals" ADD COLUMN     "discovery_run_id" UUID,
ADD COLUMN     "search_query_id" UUID;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "discovery_run_id" UUID,
ADD COLUMN     "primary_search_query_id" UUID;

-- AlterTable
ALTER TABLE "raw_leads" ADD COLUMN     "description" TEXT,
ADD COLUMN     "discovery_run_id" UUID,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "search_query_id" UUID,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "search_queries" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "country" TEXT,
ADD COLUMN     "last_result_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_run_at" TIMESTAMP(3),
ADD COLUMN     "low_performance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quality_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shortlisted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_results" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unique_companies" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "system_job_id" UUID,
    "name" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "countries" JSONB NOT NULL DEFAULT '[]',
    "categories" JSONB NOT NULL DEFAULT '[]',
    "max_queries" INTEGER NOT NULL DEFAULT 50,
    "max_discoveries" INTEGER NOT NULL DEFAULT 200,
    "minimum_score" INTEGER NOT NULL DEFAULT 82,
    "shortlist_limit" INTEGER NOT NULL DEFAULT 20,
    "raw_results" INTEGER NOT NULL DEFAULT 0,
    "relevant_results" INTEGER NOT NULL DEFAULT 0,
    "unique_companies" INTEGER NOT NULL DEFAULT 0,
    "duplicates_removed" INTEGER NOT NULL DEFAULT 0,
    "companies_analyzed" INTEGER NOT NULL DEFAULT 0,
    "contacts_found" INTEGER NOT NULL DEFAULT 0,
    "emails_verified" INTEGER NOT NULL DEFAULT 0,
    "leads_scored" INTEGER NOT NULL DEFAULT 0,
    "qualified" INTEGER NOT NULL DEFAULT 0,
    "shortlisted" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_query_runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "lead_hunt_id" UUID NOT NULL,
    "search_query_id" UUID,
    "query" TEXT NOT NULL,
    "country" TEXT,
    "category" TEXT,
    "provider" TEXT NOT NULL,
    "results_found" INTEGER NOT NULL DEFAULT 0,
    "unique_companies" INTEGER NOT NULL DEFAULT 0,
    "qualified_companies" INTEGER NOT NULL DEFAULT 0,
    "shortlisted_companies" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_query_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortlists" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "discovery_run_id" UUID,
    "name" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "minimum_score" INTEGER NOT NULL,
    "maximum_items" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortlist_items" (
    "id" UUID NOT NULL,
    "shortlist_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score_at_selection" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shortlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_enrichment_records" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contacts_found" INTEGER NOT NULL DEFAULT 0,
    "request_metadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_enrichment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_records" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "result" "EmailStatus" NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "email_verification_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discovery_runs_workspace_id_status_idx" ON "discovery_runs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "discovery_runs_workspace_id_created_at_idx" ON "discovery_runs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "discovery_query_runs_workspace_id_lead_hunt_id_idx" ON "discovery_query_runs"("workspace_id", "lead_hunt_id");

-- CreateIndex
CREATE INDEX "discovery_query_runs_workspace_id_search_query_id_idx" ON "discovery_query_runs"("workspace_id", "search_query_id");

-- CreateIndex
CREATE INDEX "shortlists_workspace_id_week_start_idx" ON "shortlists"("workspace_id", "week_start");

-- CreateIndex
CREATE INDEX "shortlist_items_lead_id_idx" ON "shortlist_items"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "shortlist_items_shortlist_id_lead_id_key" ON "shortlist_items"("shortlist_id", "lead_id");

-- CreateIndex
CREATE INDEX "contact_enrichment_records_workspace_id_company_id_idx" ON "contact_enrichment_records"("workspace_id", "company_id");

-- CreateIndex
CREATE INDEX "email_verification_records_workspace_id_email_idx" ON "email_verification_records"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "email_verification_records_workspace_id_contact_id_idx" ON "email_verification_records"("workspace_id", "contact_id");

-- AddForeignKey
ALTER TABLE "raw_leads" ADD CONSTRAINT "raw_leads_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_leads" ADD CONSTRAINT "raw_leads_discovery_run_id_fkey" FOREIGN KEY ("discovery_run_id") REFERENCES "discovery_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_primary_search_query_id_fkey" FOREIGN KEY ("primary_search_query_id") REFERENCES "search_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_discovery_run_id_fkey" FOREIGN KEY ("discovery_run_id") REFERENCES "discovery_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_signals" ADD CONSTRAINT "lead_signals_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_signals" ADD CONSTRAINT "lead_signals_discovery_run_id_fkey" FOREIGN KEY ("discovery_run_id") REFERENCES "discovery_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_query_runs" ADD CONSTRAINT "discovery_query_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_query_runs" ADD CONSTRAINT "discovery_query_runs_lead_hunt_id_fkey" FOREIGN KEY ("lead_hunt_id") REFERENCES "discovery_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_query_runs" ADD CONSTRAINT "discovery_query_runs_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_discovery_run_id_fkey" FOREIGN KEY ("discovery_run_id") REFERENCES "discovery_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlist_items" ADD CONSTRAINT "shortlist_items_shortlist_id_fkey" FOREIGN KEY ("shortlist_id") REFERENCES "shortlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlist_items" ADD CONSTRAINT "shortlist_items_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_enrichment_records" ADD CONSTRAINT "contact_enrichment_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_enrichment_records" ADD CONSTRAINT "contact_enrichment_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_records" ADD CONSTRAINT "email_verification_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_records" ADD CONSTRAINT "email_verification_records_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
