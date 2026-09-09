-- CreateEnum
CREATE TYPE "OutreachApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "IntegrationStatus" ADD VALUE 'REAUTH_REQUIRED';

-- AlterEnum
ALTER TYPE "OutreachStatus" ADD VALUE 'EDITED';
ALTER TYPE "OutreachStatus" ADD VALUE 'DRAFT_CREATED';
ALTER TYPE "OutreachStatus" ADD VALUE 'SENDING';
ALTER TYPE "OutreachStatus" ADD VALUE 'FOLLOW_UP_DUE';
ALTER TYPE "OutreachStatus" ADD VALUE 'FOLLOW_UP_SENT';
ALTER TYPE "OutreachStatus" ADD VALUE 'SUPPRESSED';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "auto_send_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_send_threshold" INTEGER NOT NULL DEFAULT 92,
ADD COLUMN     "follow_up_mode" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "strategy" TEXT NOT NULL DEFAULT 'AGENCY_PARTNERSHIP',
ADD COLUMN     "weekly_limit" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "email_replies" ADD COLUMN     "ai_confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "body_text" TEXT,
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "from_email" TEXT,
ADD COLUMN     "gmail_thread_id" TEXT,
ADD COLUMN     "lead_id" UUID,
ADD COLUMN     "meeting_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recommended_action" TEXT,
ADD COLUMN     "requires_response" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentiment" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "to_email" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "integration_connections" ADD COLUMN     "account_identifier" TEXT,
ADD COLUMN     "connected_at" TIMESTAMP(3),
ADD COLUMN     "encrypted_credentials_reference" TEXT,
ADD COLUMN     "gmail_history_id" TEXT,
ADD COLUMN     "last_error_at" TIMESTAMP(3),
ADD COLUMN     "last_gmail_sync_at" TIMESTAMP(3),
ADD COLUMN     "last_successful_at" TIMESTAMP(3),
ADD COLUMN     "scopes" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "outreach_messages" ADD COLUMN     "approval_status" "OutreachApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "follow_up_number" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "follow_up_to_id" UUID,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "generated_by_model" TEXT,
ADD COLUMN     "gmail_draft_id" TEXT,
ADD COLUMN     "gmail_header_message_id" TEXT,
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "original_generated_body" TEXT,
ADD COLUMN     "original_generated_subject" TEXT,
ADD COLUMN     "personalization_points" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "replied_at" TIMESTAMP(3),
ADD COLUMN     "strategy" TEXT NOT NULL DEFAULT 'AGENCY_PARTNERSHIP';

-- AlterTable
ALTER TABLE "suppression_list" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "auto_send_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_send_minimum_score" INTEGER NOT NULL DEFAULT 92,
ADD COLUMN     "cold_outreach_cooldown_days" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "follow_up_mode" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "max_new_contacts_per_company_per_30_days" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "opt_out_footer" TEXT;

-- CreateIndex
CREATE INDEX "email_replies_workspace_id_classification_idx" ON "email_replies"("workspace_id", "classification");

-- CreateIndex
CREATE INDEX "email_replies_workspace_id_gmail_thread_id_idx" ON "email_replies"("workspace_id", "gmail_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_replies_workspace_id_gmail_message_id_key" ON "email_replies"("workspace_id", "gmail_message_id");

-- CreateIndex
CREATE INDEX "outreach_messages_workspace_id_contact_id_idx" ON "outreach_messages"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "outreach_messages_workspace_id_gmail_thread_id_idx" ON "outreach_messages"("workspace_id", "gmail_thread_id");

-- CreateIndex
CREATE INDEX "outreach_messages_workspace_id_sent_at_idx" ON "outreach_messages"("workspace_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_messages_workspace_id_idempotency_key_key" ON "outreach_messages"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "suppression_list_workspace_id_contact_id_idx" ON "suppression_list"("workspace_id", "contact_id");

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_follow_up_to_id_fkey" FOREIGN KEY ("follow_up_to_id") REFERENCES "outreach_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
