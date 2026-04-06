-- CreateTable
CREATE TABLE "ProjectIntakeForm" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Intake',
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publicToken" TEXT,
    "targetSectionId" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIntakeForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIntakeForm_projectId_key" ON "ProjectIntakeForm"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIntakeForm_publicToken_key" ON "ProjectIntakeForm"("publicToken");

-- CreateIndex
CREATE INDEX "ProjectIntakeForm_publicToken_idx" ON "ProjectIntakeForm"("publicToken");

-- AddForeignKey
ALTER TABLE "ProjectIntakeForm" ADD CONSTRAINT "ProjectIntakeForm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIntakeForm" ADD CONSTRAINT "ProjectIntakeForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIntakeForm" ADD CONSTRAINT "ProjectIntakeForm_targetSectionId_fkey" FOREIGN KEY ("targetSectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
