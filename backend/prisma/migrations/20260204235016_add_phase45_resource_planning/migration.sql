-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "budget" DECIMAL(12,2),
ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "availability_end" TIMESTAMP(3),
ADD COLUMN     "availability_start" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "internal_hourly_cost" DECIMAL(10,2),
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "staff_role_id" TEXT;

-- CreateTable
CREATE TABLE "staff_roles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hourly_cost" DECIMAL(10,2) NOT NULL,
    "default_billable_rate" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL,
    "staff_member_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "hours_per_week" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "role_on_project" TEXT,
    "allocation_type" TEXT NOT NULL DEFAULT 'full',
    "allocation_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "allow_over_allocation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignment_monthly_allocations" (
    "id" TEXT NOT NULL,
    "staff_assignment_id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_assignment_monthly_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_role_rates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "staff_role_id" TEXT NOT NULL,
    "billable_rate" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_role_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_roles_company_id_idx" ON "staff_roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_roles_company_id_name_key" ON "staff_roles"("company_id", "name");

-- CreateIndex
CREATE INDEX "staff_assignments_staff_member_id_idx" ON "staff_assignments"("staff_member_id");

-- CreateIndex
CREATE INDEX "staff_assignments_project_id_idx" ON "staff_assignments"("project_id");

-- CreateIndex
CREATE INDEX "staff_assignments_start_date_end_date_idx" ON "staff_assignments"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "staff_assignment_monthly_allocations_staff_assignment_id_idx" ON "staff_assignment_monthly_allocations"("staff_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_assignment_monthly_allocations_staff_assignment_id_mo_key" ON "staff_assignment_monthly_allocations"("staff_assignment_id", "month");

-- CreateIndex
CREATE INDEX "project_role_rates_project_id_idx" ON "project_role_rates"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_role_rates_project_id_staff_role_id_key" ON "project_role_rates"("project_id", "staff_role_id");

-- CreateIndex
CREATE INDEX "staff_members_staff_role_id_idx" ON "staff_members"("staff_role_id");

-- AddForeignKey
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_staff_role_id_fkey" FOREIGN KEY ("staff_role_id") REFERENCES "staff_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignment_monthly_allocations" ADD CONSTRAINT "staff_assignment_monthly_allocations_staff_assignment_id_fkey" FOREIGN KEY ("staff_assignment_id") REFERENCES "staff_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_role_rates" ADD CONSTRAINT "project_role_rates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_role_rates" ADD CONSTRAINT "project_role_rates_staff_role_id_fkey" FOREIGN KEY ("staff_role_id") REFERENCES "staff_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
