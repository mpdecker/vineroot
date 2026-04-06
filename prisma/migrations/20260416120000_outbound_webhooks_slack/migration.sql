-- AlterEnum (append; safe on fresh DBs — re-apply manually if values already exist)
ALTER TYPE "AutomationActionType" ADD VALUE 'POST_WEBHOOK';
ALTER TYPE "AutomationActionType" ADD VALUE 'SLACK_NOTIFY';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "slackIncomingWebhookUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceOutboundWebhook" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "eventTypes" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceOutboundWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceOutboundWebhook_workspaceId_idx" ON "WorkspaceOutboundWebhook"("workspaceId");

ALTER TABLE "WorkspaceOutboundWebhook" ADD CONSTRAINT "WorkspaceOutboundWebhook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
