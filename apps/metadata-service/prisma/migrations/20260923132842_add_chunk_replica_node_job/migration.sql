-- CreateEnum
CREATE TYPE "ReplicaStatus" AS ENUM ('PENDING', 'HEALTHY', 'MISSING', 'RECOVERING');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "chunkNumber" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkReplica" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "storageNodeId" TEXT NOT NULL,
    "status" "ReplicaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChunkReplica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageNode" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastHeartbeat" TIMESTAMP(3),
    "capacity" BIGINT NOT NULL,
    "usedCapacity" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chunk_fileId_idx" ON "Chunk"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "Chunk_fileId_chunkNumber_key" ON "Chunk"("fileId", "chunkNumber");

-- CreateIndex
CREATE INDEX "ChunkReplica_chunkId_idx" ON "ChunkReplica"("chunkId");

-- CreateIndex
CREATE INDEX "ChunkReplica_storageNodeId_idx" ON "ChunkReplica"("storageNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChunkReplica_chunkId_storageNodeId_key" ON "ChunkReplica"("chunkId", "storageNodeId");

-- CreateIndex
CREATE INDEX "StorageNode_status_idx" ON "StorageNode"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StorageNode_host_port_key" ON "StorageNode"("host", "port");

-- CreateIndex
CREATE INDEX "ProcessingJob_fileId_idx" ON "ProcessingJob"("fileId");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkReplica" ADD CONSTRAINT "ChunkReplica_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkReplica" ADD CONSTRAINT "ChunkReplica_storageNodeId_fkey" FOREIGN KEY ("storageNodeId") REFERENCES "StorageNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
