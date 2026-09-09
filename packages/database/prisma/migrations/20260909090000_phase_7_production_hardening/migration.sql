CREATE TABLE "worker_heartbeats" (
    "id" UUID NOT NULL,
    "worker_id" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'worker',
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HEALTHY',
    "queues" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "worker_heartbeats_worker_id_key" ON "worker_heartbeats"("worker_id");
CREATE INDEX "worker_heartbeats_last_heartbeat_at_idx" ON "worker_heartbeats"("last_heartbeat_at");
