-- CreateTable
CREATE TABLE "ProjectSavedView" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSavedView_projectId_idx" ON "ProjectSavedView"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSavedView" ADD CONSTRAINT "ProjectSavedView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSavedView" ADD CONSTRAINT "ProjectSavedView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
