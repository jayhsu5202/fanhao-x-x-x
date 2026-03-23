import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import path from "node:path";
import { config } from "../config.js";

const scriptPath = path.join(config.projectRoot, "scripts", "missav_download_worker.py");

function writeAll(stream: NodeJS.WritableStream, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = (err: Error) => {
      stream.off("error", onErr);
      reject(err);
    };
    stream.once("error", onErr);
    if (stream.write(data, "utf8")) {
      stream.off("error", onErr);
      resolve();
    } else {
      stream.once("drain", () => {
        stream.off("error", onErr);
        resolve();
      });
    }
  });
}

class PythonDownloadWorker {
  private proc: ChildProcess | null = null;
  private rl: Interface | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor() {
    this.spawn();
  }

  private spawn(): void {
    this.proc = spawn(config.pythonPath, ["-u", scriptPath], {
      cwd: config.projectRoot,
      env: { ...process.env, PYTHONPATH: config.projectRoot, PYTHONUNBUFFERED: "1" },
    });
    if (!this.proc.stdout) throw new Error("download worker: no stdout");
    this.rl = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    this.proc.on("close", () => {
      this.rl?.close();
      this.rl = null;
      this.proc = null;
    });
  }

  private ensure(): void {
    if (!this.proc?.stdin || !this.rl) this.spawn();
  }

  runJob(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const run = async (): Promise<{ ok: boolean; error?: string }> => {
      this.ensure();
      const proc = this.proc!;
      const rl = this.rl!;
      await writeAll(proc.stdin!, `${JSON.stringify(payload)}\n`);
      const line = await new Promise<string>((resolve, reject) => {
        rl.once("line", resolve);
        rl.once("error", reject);
      });
      const j = JSON.parse(line) as { ok: boolean; error?: string };
      return j;
    };
    const p = this.tail.then(run, run);
    this.tail = p.then(
      () => undefined,
      () => undefined
    );
    return p;
  }
}

const maxWorkers = Math.max(1, Math.min(64, config.downloadQueueConcurrency));
const workers: PythonDownloadWorker[] = [];
const free = new Set<number>();
const waiters: Array<(idx: number) => void> = [];

let poolReady = false;

function ensurePool(): void {
  if (poolReady) return;
  poolReady = true;
  for (let i = 0; i < maxWorkers; i++) {
    workers.push(new PythonDownloadWorker());
    free.add(i);
  }
}

async function acquireWorker(): Promise<PythonDownloadWorker> {
  ensurePool();
  if (free.size > 0) {
    const idx = free.values().next().value!;
    free.delete(idx);
    return workers[idx]!;
  }
  return new Promise((resolve) => {
    waiters.push((idx: number) => resolve(workers[idx]!));
  });
}

function releaseWorker(w: PythonDownloadWorker): void {
  const idx = workers.indexOf(w);
  if (idx < 0) return;
  const next = waiters.shift();
  if (next) next(idx);
  else free.add(idx);
}

function runDownloadViaSpawnLegacy(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(config.pythonPath, [config.workerScript], {
      cwd: config.projectRoot,
      env: { ...process.env, PYTHONPATH: config.projectRoot, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", (e) => {
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr.slice(-500) || `程序結束碼 ${code ?? "?"}` });
    });
    const { jobId: _j, ...rest } = payload;
    child.stdin?.write(JSON.stringify(rest));
    child.stdin?.end();
  });
}

/**
 * 使用長駐 `missav_download_worker.py`（重用 Client）；失敗時回退單次 `missav_worker.py`。
 */
export async function runDownloadJob(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const w = await acquireWorker();
    try {
      return await w.runJob(payload);
    } finally {
      releaseWorker(w);
    }
  } catch {
    return runDownloadViaSpawnLegacy(payload);
  }
}

export function getDownloadWorkerPoolStats(): { downloadWorkerPoolSize: number } {
  return { downloadWorkerPoolSize: maxWorkers };
}
