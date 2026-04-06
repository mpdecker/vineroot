-- CreateTable
CREATE TABLE "ProjectWorkspace" (
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectWorkspace_pkey" PRIMARY KEY ("projectId","workspaceId")
);

-- AddForeignKey
ALTER TABLE "ProjectWorkspace" ADD CONSTRAINT "ProjectWorkspace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkspace" ADD CONSTRAINT "ProjectWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProjectWorkspace_workspaceId_idx" ON "ProjectWorkspace"("workspaceId");

CREATE INDEX "ProjectWorkspace_projectId_idx" ON "ProjectWorkspace"("projectId");

-- Existing single-workspace links
INSERT INTO "ProjectWorkspace" ("projectId", "workspaceId", "joinedAt")
SELECT p."id", p."workspaceId", CURRENT_TIMESTAMP
FROM "Project" p
WHERE p."workspaceId" IS NOT NULL;

-- Projects that had no workspace: attach to creator's first workspace membership (if any)
INSERT INTO "ProjectWorkspace" ("projectId", "workspaceId", "joinedAt")
SELECT DISTINCT ON (p."id") p."id", wm."workspaceId", CURRENT_TIMESTAMP
FROM "Project" p
INNER JOIN "WorkspaceMember" wm ON wm."userId" = p."createdById"
WHERE p."workspaceId" IS NULL
AND NOT EXISTS (SELECT 1 FROM "ProjectWorkspace" pw WHERE pw."projectId" = p."id")
ORDER BY p."id", wm."joinedAt" ASC;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Project" p
    WHERE NOT EXISTS (SELECT 1 FROM "ProjectWorkspace" pw WHERE pw."projectId" = p."id")
  ) THEN
    RAISE EXCEPTION 'Migration failed: some projects have no workspace link. Ensure each project creator is a workspace member, or delete orphan projects.';
  END IF;
END $$;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_workspaceId_fkey";
ALTER TABLE "Project" DROP COLUMN "workspaceId";

UPDATE "Task" t
SET "workspaceId" = sub."workspaceId"
FROM (
  SELECT t2."id" AS tid, (
    SELECT pw."workspaceId" FROM "ProjectWorkspace" pw
    WHERE pw."projectId" = t2."projectId"
    ORDER BY pw."joinedAt" ASC
    LIMIT 1
  ) AS "workspaceId"
  FROM "Task" t2
  WHERE t2."projectId" IS NOT NULL
) sub
WHERE t."id" = sub.tid AND sub."workspaceId" IS NOT NULL AND t."workspaceId" IS NULL;
