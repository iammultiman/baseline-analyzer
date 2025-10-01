-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'GEMINI', 'CLAUDE', 'QWEN', 'OPENROUTER');

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "api_key" TEXT NOT NULL,
    "base_url" TEXT,
    "model" VARCHAR(255),
    "max_tokens" INTEGER,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "cost_per_token" DOUBLE PRECISION,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_configs_organization_id_provider_name_key" ON "ai_provider_configs"("organization_id", "provider", "name");

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;