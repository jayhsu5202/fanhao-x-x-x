import "../config.js";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function ensureSqliteSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DownloadJob" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL,
      "quality" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "message" TEXT,
      "outputPath" TEXT,
      "filename" TEXT,
      "fileSizeBytes" BIGINT,
      "ffmpegExitCode" INTEGER,
      "ffmpegSummary" TEXT,
      "startedAt" DATETIME,
      "finishedAt" DATETIME,
      "verifiedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE "DownloadJob" ADD COLUMN "fileSizeBytes" BIGINT`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DownloadJob" ADD COLUMN "ffmpegExitCode" INTEGER`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DownloadJob" ADD COLUMN "ffmpegSummary" TEXT`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DownloadJob" ADD COLUMN "startedAt" DATETIME`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DownloadJob" ADD COLUMN "finishedAt" DATETIME`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DownloadJob" ADD COLUMN "verifiedAt" DATETIME`).catch(() => undefined);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Favorite" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL,
      "title" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_slug_key" ON "Favorite"("slug")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DownloadJob_slug_quality_idx" ON "DownloadJob"("slug", "quality")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DownloadJob_status_idx" ON "DownloadJob"("status")`
  );
}
