-- Phase 11: Advanced User Management & Role-Based Permissions Migration

-- AlterTable: Add Phase 11 fields to permissions table
ALTER TABLE "permissions" 
  ADD COLUMN "resource" TEXT,
  ADD COLUMN "action" TEXT,
  ADD COLUMN "scope" TEXT DEFAULT 'project',
  ADD COLUMN "updated_at" TIMESTAMP(3);

-- Set updated_at to created_at for existing rows
UPDATE "permissions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- AlterTable: Add Phase 11 fields to roles table
ALTER TABLE "roles" 
  ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "default_permissions" JSONB,
  ADD COLUMN "updated_at" TIMESTAMP(3);

-- Set updated_at to created_at for existing rows
UPDATE "roles" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- CreateTable: UserRole junction model
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "project_id" TEXT,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectPermission model
CREATE TABLE "project_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_permissions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey for UserRole
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for ProjectPermission
ALTER TABLE "project_permissions" ADD CONSTRAINT "project_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_permissions" ADD CONSTRAINT "project_permissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "user_roles_project_id_idx" ON "user_roles"("project_id");
CREATE INDEX "user_roles_user_id_project_id_idx" ON "user_roles"("user_id", "project_id");

CREATE UNIQUE INDEX "project_permissions_user_id_project_id_permission_key" ON "project_permissions"("user_id", "project_id", "permission");
CREATE INDEX "project_permissions_user_id_project_id_idx" ON "project_permissions"("user_id", "project_id");
CREATE INDEX "project_permissions_project_id_idx" ON "project_permissions"("project_id");

-- Create unique constraint on permissions (resource, action, scope) if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_resource_action_scope_key" ON "permissions"("resource", "action", "scope") WHERE "resource" IS NOT NULL AND "action" IS NOT NULL AND "scope" IS NOT NULL;
