-- Add Question model (per-map free-form interview questions)
-- Restores legacy /map/{id}/questions feature.

CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "questions_map_id_idx" ON "questions"("map_id");

ALTER TABLE "questions" ADD CONSTRAINT "questions_map_id_fkey"
    FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
