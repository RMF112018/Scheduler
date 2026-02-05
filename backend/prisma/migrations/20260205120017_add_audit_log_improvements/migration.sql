/*
  Warnings:

  - You are about to drop the column `ip_address` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `new_data` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `old_data` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `user_agent` on the `audit_logs` table. All the data in the column will be lost.
  - Added the required column `changes` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Made the column `user_id` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "audit_logs_created_at_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "ip_address",
DROP COLUMN "new_data",
DROP COLUMN "old_data",
DROP COLUMN "user_agent",
ADD COLUMN     "changes" JSONB NOT NULL,
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "user_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "lookahead_activity_comments" (
    "id" TEXT NOT NULL,
    "lookahead_activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "mentions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookahead_activity_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookahead_comment_reactions" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookahead_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lookahead_activity_comments_lookahead_activity_id_idx" ON "lookahead_activity_comments"("lookahead_activity_id");

-- CreateIndex
CREATE INDEX "lookahead_activity_comments_user_id_idx" ON "lookahead_activity_comments"("user_id");

-- CreateIndex
CREATE INDEX "lookahead_activity_comments_parent_id_idx" ON "lookahead_activity_comments"("parent_id");

-- CreateIndex
CREATE INDEX "lookahead_comment_reactions_comment_id_idx" ON "lookahead_comment_reactions"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "lookahead_comment_reactions_comment_id_user_id_emoji_key" ON "lookahead_comment_reactions"("comment_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "lookahead_activity_comments" ADD CONSTRAINT "lookahead_activity_comments_lookahead_activity_id_fkey" FOREIGN KEY ("lookahead_activity_id") REFERENCES "lookahead_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookahead_activity_comments" ADD CONSTRAINT "lookahead_activity_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookahead_activity_comments" ADD CONSTRAINT "lookahead_activity_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "lookahead_activity_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookahead_comment_reactions" ADD CONSTRAINT "lookahead_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "lookahead_activity_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookahead_comment_reactions" ADD CONSTRAINT "lookahead_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
