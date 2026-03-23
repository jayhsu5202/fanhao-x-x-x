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
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
