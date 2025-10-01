-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable - Convert embedding column to vector type
ALTER TABLE "baseline_data" DROP COLUMN "embedding";
ALTER TABLE "baseline_data" ADD COLUMN "embedding" vector(1536);

-- CreateIndex - Add vector similarity index
CREATE INDEX "baseline_data_embedding_idx" ON "baseline_data" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);