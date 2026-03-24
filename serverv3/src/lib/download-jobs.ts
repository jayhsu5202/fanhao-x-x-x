import { randomUUID } from "node:crypto";
import { accessSync, constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import PQueue from "p-queue";
import { config } from "../config.js";
import { nestedDownloadRelDir } from "./download-paths.js";
import { runHlsDownloadJob } from "./hls-downloader.js";
import { prisma } from "./prisma.js";
import type { DownloadJob as DbJob } from "@prisma/client";

export type JobStatus = "pending" | "running" | "verifying" | "done" | "error";

export type DownloadJob = {
  id: string;
  status: JobStatus;
  slug: string;
  quality: string;
  message?: string;
  outputPath?: string;
  filename?: string;
  fileSizeBytes?: bigint;
  ffmpegExitCode?: number;
  ffmpegSummary?: string;
  startedAt?: number;
  finishedAt?: number;
  verifiedAt?: number;
  createdAt: number;
};

const queue = new PQueue({ concurrency: config.downloadQueueConcurrency });

function rowToJob(row: DbJob): DownloadJob {
  return {
    id: row.id,
    status: row.status as JobStatus,
    slug: row.slug,
    quality: row.quality,
    message: row.message ?? undefined,
    outputPath: row.outputPath ?? undefined,
    filename: row.filename ?? undefined,
    fileSizeBytes: row.fileSizeBytes ?? undefined,
    ffmpegExitCode: row.ffmpegExitCode ?? undefined,
    ffmpegSummary: row.ffmpegSummary ?? undefined,
    startedAt: row.startedAt?.getTime(),
    finishedAt: row.finishedAt?.getTime(),
    verifiedAt: row.verifiedAt?.getTime(),
    createdAt: row.createdAt.getTime(),
  };
}

const MIN_VALID_DOWNLOAD_BYTES = 256 * 1024;

function outputFileReadable(outputPath: string | undefined | null): boolean {
  if (!outputPath) return false;
  try {
    accessSync(outputPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function statReadableOutput(outputPath: string | undefined | null): Promise<{ ok: boolean; size: bigint; reason?: string }> {
  if (!outputPath) return { ok: false, size: BigInt(0), reason: "缺少輸出檔路徑" };
  if (!outputFileReadable(outputPath)) return { ok: false, size: BigInt(0), reason: "輸出檔不存在或不可讀" };
  try {
    const st = await fs.stat(outputPath);
    if (!st.isFile()) return { ok: false, size: BigInt(0), reason: "輸出路徑不是檔案" };
    const size = BigInt(st.size);
    if (size < BigInt(MIN_VALID_DOWNLOAD_BYTES)) {
      return { ok: false, size, reason: `輸出檔過小（${st.size} bytes）` };
    }
    return { ok: true, size };
  } catch {
    return { ok: false, size: BigInt(0), reason: "無法讀取輸出檔資訊" };
  }
}

/** 服務啟動時：先前未結束的佇列／下載視為已中斷（子程序已不存在） */
export async function markAbortedJobsAfterRestart(): Promise<void> {
  await prisma.downloadJob.updateMany({
    where: { status: { in: ["pending", "running", "verifying"] } },
    data: { status: "error", message: "服務重啟，請重新下載", finishedAt: new Date() },
  });
}

export async function getJob(id: string): Promise<DownloadJob | undefined> {
  const row = await prisma.downloadJob.findUnique({ where: { id } });
  return row ? rowToJob(row) : undefined;
}

export async function findCompletedJobForSlug(
  slug: string,
  quality: string
): Promise<DownloadJob | undefined> {
  const rows = await prisma.downloadJob.findMany({
    where: { slug, quality, status: "done", verifiedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    const stat = await statReadableOutput(row.outputPath);
    if (stat.ok) return rowToJob(row);
  }
  return undefined;
}

export async function findActiveJobForSlug(
  slug: string,
  quality: string
): Promise<DownloadJob | undefined> {
  const row = await prisma.downloadJob.findFirst({
    where: { slug, quality, status: { in: ["pending", "running", "verifying"] } },
    orderBy: { createdAt: "desc" },
  });
  return row ? rowToJob(row) : undefined;
}

export async function getDownloadQueueStats(): Promise<{
  concurrency: number;
  pendingJobs: number;
  runningJobs: number;
  verifyingJobs: number;
}> {
  const [pendingJobs, runningJobs, verifyingJobs] = await Promise.all([
    prisma.downloadJob.count({ where: { status: "pending" } }),
    prisma.downloadJob.count({ where: { status: "running" } }),
    prisma.downloadJob.count({ where: { status: "verifying" } }),
  ]);
  return {
    concurrency: config.downloadQueueConcurrency,
    pendingJobs,
    runningJobs,
    verifyingJobs,
  };
}

export async function createDownloadJob(
  slug: string,
  quality: string,
  missavPageBase?: string
): Promise<DownloadJob> {
  const id = randomUUID();
  await prisma.downloadJob.create({
    data: { id, slug, quality, status: "pending", message: "等待下載佇列" },
  });

  void queue.add(async () => {
    const rel = nestedDownloadRelDir(slug);
    const dir = path.join(config.downloadDir, rel, id);
    await fs.mkdir(dir, { recursive: true });
    const outFile = path.join(dir, "video.mp4");
    const filename = `${slug.replace(/[^a-zA-Z0-9._-]+/g, "_")}.mp4`;
    const startedAt = new Date();

    await prisma.downloadJob.update({
      where: { id },
      data: {
        status: "running",
        message: "HLS 分段下載中",
        outputPath: outFile,
        filename,
        startedAt,
      },
    });

    const base = (missavPageBase ?? config.missavBaseUrl).replace(/\/$/, "");
    const pageUrl = `${base}/${slug}`;

    try {
      const result = await runHlsDownloadJob({
        pageUrl,
        outputPath: outFile,
        quality,
      });
      const finishedAt = new Date();
      const segSummary = `已下載 ${result.segmentCount} 個 segment`;

      await prisma.downloadJob.update({
        where: { id },
        data: {
          status: "verifying",
          message: "驗證下載檔案中",
          ffmpegExitCode: null,
          ffmpegSummary: segSummary,
          finishedAt,
        },
      });

      const stat = await statReadableOutput(outFile);
      if (result.ok && stat.ok) {
        await prisma.downloadJob.update({
          where: { id },
          data: {
            status: "done",
            message: "完成",
            fileSizeBytes: stat.size,
            ffmpegExitCode: null,
            ffmpegSummary: segSummary,
            finishedAt,
            verifiedAt: new Date(),
          },
        });
        return;
      }

      await fs.rm(outFile, { force: true }).catch(() => undefined);
      const failureMessage = result.ok
        ? (stat.reason ?? "下載檔驗證失敗")
        : (result.error ?? "下載失敗");
      await prisma.downloadJob.update({
        where: { id },
        data: {
          status: "error",
          message: failureMessage.slice(0, 500),
          fileSizeBytes: stat.size,
          ffmpegExitCode: null,
          ffmpegSummary: (result.error ?? "").slice(0, 500),
          finishedAt,
          verifiedAt: null,
        },
      });
    } catch (error) {
      await fs.rm(outFile, { force: true }).catch(() => undefined);
      await prisma.downloadJob.update({
        where: { id },
        data: {
          status: "error",
          message: (error instanceof Error ? error.message : "下載失敗").slice(0, 500),
          finishedAt: new Date(),
        },
      });
    }
  });

  const row = await prisma.downloadJob.findUniqueOrThrow({ where: { id } });
  return rowToJob(row);
}

export async function pruneOldJobs(): Promise<void> {
  const ttl = 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - ttl);
  const old = await prisma.downloadJob.findMany({
    where: { createdAt: { lt: cutoff } },
  });
  for (const row of old) {
    await prisma.downloadJob.delete({ where: { id: row.id } });
    try {
      const p = row.outputPath ? path.dirname(row.outputPath) : path.join(config.downloadDir, row.id);
      await fs.rm(p, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

setInterval(() => {
  void pruneOldJobs();
}, 60 * 60 * 1000);
