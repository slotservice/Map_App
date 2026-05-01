-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'vendor', 'viewer', 'worker');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('needs_scheduled', 'scheduled_or_complete');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('before', 'after', 'tag_alert', 'property_view', 'signature');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "state" VARCHAR(20),
    "zip" VARCHAR(20),
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "legacy_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "label" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maps" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "source_filename" TEXT,
    "task_columns" JSONB NOT NULL DEFAULT '[]',
    "count_columns" JSONB NOT NULL DEFAULT '[]',
    "tag_alert_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" UUID,
    "archived_at" TIMESTAMP(3),
    "legacy_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_assignments" (
    "map_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_assignments_pkey" PRIMARY KEY ("map_id","user_id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "store_number" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "state" VARCHAR(20),
    "address" TEXT,
    "zip" VARCHAR(20),
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "type" VARCHAR(50),
    "manager" VARCHAR(100),
    "regional" VARCHAR(100),
    "notes" TEXT,
    "property_image_key" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "legacy_task_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_tasks" (
    "store_id" UUID NOT NULL,
    "task_name" TEXT NOT NULL,
    "initial_status" "TaskStatus" NOT NULL,
    "current_status" "TaskStatus" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_tasks_pkey" PRIMARY KEY ("store_id","task_name")
);

-- CreateTable
CREATE TABLE "completions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "completed_by" UUID NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "signature_photo_id" UUID,
    "general_comments" TEXT NOT NULL DEFAULT '',
    "completed_at" TIMESTAMP(3) NOT NULL,
    "device_timezone" VARCHAR(64) NOT NULL,
    "legacy_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completion_counts" (
    "completion_id" UUID NOT NULL,
    "count_name" VARCHAR(100) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "completion_counts_pkey" PRIMARY KEY ("completion_id","count_name")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "completion_id" UUID,
    "kind" "PhotoKind" NOT NULL,
    "field_name" VARCHAR(100),
    "object_key" TEXT NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "finalized_at" TIMESTAMP(3),
    "legacy_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_alerts" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "raised_by" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "raised_at" TIMESTAMP(3) NOT NULL,
    "email_status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "email_sent_at" TIMESTAMP(3),
    "email_error" TEXT,
    "legacy_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_alert_photos" (
    "tag_alert_id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,

    CONSTRAINT "tag_alert_photos_pkey" PRIMARY KEY ("tag_alert_id","photo_id")
);

-- CreateTable
CREATE TABLE "outbox_items" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_id_key" ON "users"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_push_token_key" ON "device_tokens"("push_token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "maps_legacy_id_key" ON "maps"("legacy_id");

-- CreateIndex
CREATE INDEX "map_assignments_user_id_idx" ON "map_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_legacy_task_id_key" ON "stores"("legacy_task_id");

-- CreateIndex
CREATE INDEX "stores_map_id_idx" ON "stores"("map_id");

-- CreateIndex
CREATE UNIQUE INDEX "completions_signature_photo_id_key" ON "completions"("signature_photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "completions_legacy_id_key" ON "completions"("legacy_id");

-- CreateIndex
CREATE INDEX "completions_store_id_idx" ON "completions"("store_id");

-- CreateIndex
CREATE INDEX "completions_completed_by_idx" ON "completions"("completed_by");

-- CreateIndex
CREATE INDEX "photos_store_id_idx" ON "photos"("store_id");

-- CreateIndex
CREATE INDEX "photos_completion_id_idx" ON "photos"("completion_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_alerts_legacy_id_key" ON "tag_alerts"("legacy_id");

-- CreateIndex
CREATE INDEX "tag_alerts_store_id_idx" ON "tag_alerts"("store_id");

-- CreateIndex
CREATE INDEX "outbox_items_status_scheduled_at_idx" ON "outbox_items"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "audit_log_resource_type_resource_id_idx" ON "audit_log"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maps" ADD CONSTRAINT "maps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_assignments" ADD CONSTRAINT "map_assignments_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_assignments" ADD CONSTRAINT "map_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_tasks" ADD CONSTRAINT "store_tasks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completions" ADD CONSTRAINT "completions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completions" ADD CONSTRAINT "completions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completions" ADD CONSTRAINT "completions_signature_photo_id_fkey" FOREIGN KEY ("signature_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_counts" ADD CONSTRAINT "completion_counts_completion_id_fkey" FOREIGN KEY ("completion_id") REFERENCES "completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_completion_id_fkey" FOREIGN KEY ("completion_id") REFERENCES "completions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_alerts" ADD CONSTRAINT "tag_alerts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_alerts" ADD CONSTRAINT "tag_alerts_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_alert_photos" ADD CONSTRAINT "tag_alert_photos_tag_alert_id_fkey" FOREIGN KEY ("tag_alert_id") REFERENCES "tag_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_alert_photos" ADD CONSTRAINT "tag_alert_photos_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
