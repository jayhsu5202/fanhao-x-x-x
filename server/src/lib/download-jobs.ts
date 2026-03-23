import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import PQueue from "p-queue";
import { config } from "../config.js";
import { nestedDownloadRelDir } from "./download-paths.js";
import { prisma } from "./prisma.js";
import type { DownloadJob as DbJob } from "@prisma/client";

export type JobStatus = "pending" | "running" | "done" | "error";

export type DownloadJob = {
  id: string;
  status: JobStatus;
  slug: string;
  quality: string;
  message?: string;
  outputPath?: string;
  filename?: string;
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
    createdAt: row.createdAt.getTime(),
  };
}

function outputFileReadable(outputPath: string | undefined | null): boolean {
  if (!outputPath) return false;
  try {
    accessSync(outputPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** 服務啟動時：先前未結束的佇列／下載視為已中斷（子程序已不存在） */
export async function markAbortedJobsAfterRestart(): Promise<void> {
  await prisma.downloadJob.updateMany({
    where: { status: { in: ["pending", "running"] } },
    data: { status: "error", message: "服務重啟，請重新下載" },
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
    where: { slug, quality, status: "done" },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    if (outputFileReadable(row.outputPath)) return rowToJob(row);
  }
  return undefined;
}

export async function findActiveJobForSlug(
  slug: string,
  quality: string
): Promise<DownloadJob | undefined> {
  const row = await prisma.downloadJob.findFirst({
    where: { slug, quality, status: { in: ["pending", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  return row ? rowToJob(row) : undefined;
}

export async function getDownloadQueueStats(): Promise<{
  concurrency: number;
  pendingJobs: number;
  runningJobs: number;
}> {
  const [pendingJobs, runningJobs] = await Promise.all([
    prisma.downloadJob.count({ where: { status: "pending" } }),
    prisma.downloadJob.count({ where: { status: "running" } }),
  ]);
  return {
    concurrency: config.downloadQueueConcurrency,
    pendingJobs,
    runningJobs,
  };
}

export async function createDownloadJob(
  slug: string,
  quality: string,
  missavPageBase?: string
): Promise<DownloadJob> {
  const id = randomUUID();
  await prisma.downloadJob.create({
    data: { id, slug, quality, status: "pending" },
  });

  void queue.add(async () => {
    const rel = nestedDownloadRelDir(slug);
    const dir = path.join(config.downloadDir, rel, id);
    await fs.mkdir(dir, { recursive: true });
    const outFile = path.join(dir, "video.mp4");
    const filename = `${slug.replace(/[^a-zA-Z0-9._-]+/g, "_")}.mp4`;

    await prisma.downloadJob.update({
      where: { id },
      data: {
        status: "running",
        outputPath: outFile,
        filename,
      },
    });

    const base = (missavPageBase ?? config.missavBaseUrl).replace(/\/$/, "");
    const pageUrl = `${base}/${slug}`;
    const payload = JSON.stringify({
      pageUrl,
      outputPath: outFile,
      quality,
    });

    await new Promise<void>((resolve) => {
      const child = spawn(config.pythonPath, [config.workerScript], {
        cwd: config.projectRoot,
        env: {
          ...process.env,
          PYTHONPATH: config.projectRoot,
          PYTHONUNBUFFERED: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stderr = "";
      let settled = false;
      const finish = (code: number | null, errMsg?: string) => {
        if (settled) return;
        settled = true;
        void (async () => {
          if (code === 0) {
            await prisma.downloadJob.update({
              where: { id },
              data: { status: "done", message: "完成" },
            });
          } else {
            await prisma.downloadJob.update({
              where: { id },
              data: {
                status: "error",
                message: errMsg || stderr.slice(-500) || `程序結束碼 ${code ?? "?"}`,
              },
            });
          }
          resolve();
        })();
      };
      child.stderr?.on("data", (c: Buffer) => {
        stderr += c.toString();
      });
      child.on("error", (e) => {
        finish(null, e instanceof Error ? e.message : String(e));
      });
      child.on("close", (code) => {
        finish(code ?? 1);
      });
      child.stdin?.write(payload);
      child.stdin?.end();
    });
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
