import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import PQueue from "p-queue";
import { config } from "../config.js";
import { nestedDownloadRelDir } from "./download-paths.js";

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

const jobs = new Map<string, DownloadJob>();
const queue = new PQueue({ concurrency: config.downloadQueueConcurrency });

export function getJob(id: string): DownloadJob | undefined {
  return jobs.get(id);
}

function outputFileReadable(outputPath: string | undefined): boolean {
  if (!outputPath) return false;
  try {
    accessSync(outputPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** 同 slug+quality 已有完成且檔案仍在時重用，避免重複排隊合併 */
export function findCompletedJobForSlug(slug: string, quality: string): DownloadJob | undefined {
  let best: DownloadJob | undefined;
  for (const job of jobs.values()) {
    if (job.status !== "done" || job.slug !== slug || job.quality !== quality) continue;
    if (!outputFileReadable(job.outputPath)) continue;
    if (!best || job.createdAt > best.createdAt) best = job;
  }
  return best;
}

/** 進行中或排隊中的同一部影片（取最新一筆） */
export function findActiveJobForSlug(slug: string, quality: string): DownloadJob | undefined {
  let best: DownloadJob | undefined;
  for (const job of jobs.values()) {
    if (job.status !== "pending" && job.status !== "running") continue;
    if (job.slug !== slug || job.quality !== quality) continue;
    if (!best || job.createdAt > best.createdAt) best = job;
  }
  return best;
}

/** 供前端顯示佇列負載（非精確排序，僅統計筆數） */
export function getDownloadQueueStats(): {
  concurrency: number;
  pendingJobs: number;
  runningJobs: number;
} {
  let pendingJobs = 0;
  let runningJobs = 0;
  for (const job of jobs.values()) {
    if (job.status === "pending") pendingJobs += 1;
    else if (job.status === "running") runningJobs += 1;
  }
  return {
    concurrency: config.downloadQueueConcurrency,
    pendingJobs,
    runningJobs,
  };
}

export function createDownloadJob(slug: string, quality: string, missavPageBase?: string): DownloadJob {
  const id = randomUUID();
  const job: DownloadJob = {
    id,
    status: "pending",
    slug,
    quality,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  void queue.add(async () => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "running";
    const rel = nestedDownloadRelDir(slug);
    const dir = path.join(config.downloadDir, rel, id);
    await fs.mkdir(dir, { recursive: true });
    const outFile = path.join(dir, "video.mp4");
    j.outputPath = outFile;
    j.filename = `${slug.replace(/[^a-zA-Z0-9._-]+/g, "_")}.mp4`;

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
      child.stderr?.on("data", (c: Buffer) => {
        stderr += c.toString();
      });
      child.on("close", (code) => {
        const jj = jobs.get(id);
        if (!jj) {
          resolve();
          return;
        }
        if (code === 0) {
          jj.status = "done";
          jj.message = "完成";
        } else {
          jj.status = "error";
          jj.message = stderr.slice(-500) || `程序結束碼 ${code}`;
        }
        resolve();
      });
      child.stdin?.write(payload);
      child.stdin?.end();
    });
  });

  return job;
}

/** 刪除過期 job（24h） */
export async function pruneOldJobs(): Promise<void> {
  const ttl = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > ttl) {
      jobs.delete(id);
      try {
        const p = job.outputPath ? path.dirname(job.outputPath) : path.join(config.downloadDir, id);
        await fs.rm(p, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

setInterval(() => {
  void pruneOldJobs();
}, 60 * 60 * 1000);
