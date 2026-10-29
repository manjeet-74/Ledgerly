-- CreateEnum
CREATE TYPE "Workspace" AS ENUM ('DEMO', 'LIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MARKETING_DIRECTOR', 'FINANCE', 'EXECUTOR', 'AUDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('BUDGET_SHIFT', 'ANOMALY_ALERT');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'LIVE', 'COMPLETED', 'REJECTED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('DATA', 'MODEL', 'RULE', 'CALC');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PASS', 'FAIL', 'INFO');

-- CreateEnum
CREATE TYPE "ApprovalStep" AS ENUM ('MARKETING', 'FINANCE', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "ApprovalResult" AS ENUM ('PENDING', 'GRANTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricRow" (
    "id" TEXT NOT NULL,
    "workspace" "Workspace" NOT NULL,
    "date" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "uploadId" TEXT,

    CONSTRAINT "MetricRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "workspace" "Workspace" NOT NULL,
    "filename" TEXT NOT NULL,
    "rowsOk" INTEGER NOT NULL,
    "rowsBad" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "workspace" "Workspace" NOT NULL,
    "type" "DecisionType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "DecisionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "expectedImpact" DECIMAL(14,2) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "params" JSONB NOT NULL,
    "spendCap" DECIMAL(14,2),
    "rollbackRule" JSONB,
    "owner" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceStep" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "EvidenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "step" "ApprovalStep" NOT NULL,
    "order" INTEGER NOT NULL,
    "result" "ApprovalResult" NOT NULL DEFAULT 'PENDING',
    "actorName" TEXT,
    "actorRole" "Role",
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "promised" DECIMAL(14,2) NOT NULL,
    "delivered" DECIMAL(14,2) NOT NULL,
    "confidenceBefore" DOUBLE PRECISION NOT NULL,
    "confidenceAfter" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "workspace" "Workspace" NOT NULL,
    "name" TEXT NOT NULL,
    "tiers" JSONB NOT NULL,
    "engine" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspace" "Workspace" NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "decisionId" TEXT,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "MetricRow_workspace_date_idx" ON "MetricRow"("workspace", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricRow_workspace_date_channel_key" ON "MetricRow"("workspace", "date", "channel");

-- CreateIndex
CREATE INDEX "Decision_workspace_status_idx" ON "Decision"("workspace", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_decisionId_step_key" ON "Approval"("decisionId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_decisionId_key" ON "Outcome"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_workspace_key" ON "Policy"("workspace");

-- CreateIndex
CREATE INDEX "AuditEvent_workspace_decisionId_idx" ON "AuditEvent"("workspace", "decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_workspace_seq_key" ON "AuditEvent"("workspace", "seq");

-- AddForeignKey
ALTER TABLE "EvidenceStep" ADD CONSTRAINT "EvidenceStep_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
