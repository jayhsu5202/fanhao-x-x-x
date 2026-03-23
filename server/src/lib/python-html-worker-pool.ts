import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import type { Readable } from "node:stream";
import { config } from "../config.js";

const scriptPath = path.join(config.projectRoot, "scripts", "missav_html_worker.py");

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

class StdoutReader {
  private buf = Buffer.alloc(0);

  constructor(private readonly stream: Readable) {}

  async read(n: number): Promise<Buffer> {
    while (this.buf.length < n) {
      const chunk = this.stream.read() as Buffer | null;
      if (chunk) {
        this.buf = Buffer.concat([this.buf, chunk]);
        continue;
      }
      if (this.stream.readableEnded) break;
      await once(this.stream, "readable");
    }
    if (this.buf.length < n) throw new Error("unexpected EOF reading python worker stdout");
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return Buffer.from(out);
  }
}

class PythonHtmlWorker {
  private proc: ChildProcess | null = null;
  private reader: StdoutReader | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor() {
    this.spawn();
  }

  private spawn(): void {
    this.proc = spawn(config.pythonPath, ["-u", scriptPath], {
      cwd: config.projectRoot,
      env: { ...process.env, PYTHONPATH: config.projectRoot, PYTHONUNBUFFERED: "1" },
    });
    if (!this.proc.stdout) throw new Error("python worker: no stdout");
    this.reader = new StdoutReader(this.proc.stdout);
    this.proc.on("error", () => {
      this.proc = null;
      this.reader = null;
    });
    this.proc.on("close", () => {
      this.proc = null;
      this.reader = null;
    });
  }

  private ensure(): void {
    if (!this.proc?.stdin || !this.reader) this.spawn();
  }

  fetch(pageUrl: string, acceptLanguage?: string): Promise<string> {
    const run = async (): Promise<string> => {
      this.ensure();
      const proc = this.proc!;
      const reader = this.reader!;
      const stdin = proc.stdin!;
      const payload = `${JSON.stringify({ url: pageUrl, accept_language: acceptLanguage ?? null })}\n`;
      await writeAll(stdin, payload);
      const lenBuf = await reader.read(4);
      const n = lenBuf.readUInt32BE(0);
      if (n === 0) {
        const elenBuf = await reader.read(4);
        const elen = elenBuf.readUInt32BE(0);
        const emsg = await reader.read(elen);
        throw new Error(emsg.toString("utf8"));
      }
      if (n > 80 * 1024 * 1024) throw new Error("html response too large");
      const body = await reader.read(n);
      return body.toString("utf8");
    };
    const p = this.tail.then(run, run);
    this.tail = p.then(
      () => undefined,
      () => undefined
    );
    return p;
  }
}

let pool: PythonHtmlWorker[] | null = null;
let rr = 0;

function getPool(): PythonHtmlWorker[] {
  if (!pool) {
    const n = Math.max(1, config.pythonHtmlWorkerCount);
    pool = Array.from({ length: n }, () => new PythonHtmlWorker());
  }
  return pool;
}

/** 每次冷啟動 Python（程序池失敗時後備） */
export function fetchMissavHtmlViaPythonSpawn(pageUrl: string, acceptLanguage?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const legacy = path.join(config.projectRoot, "scripts", "fetch_missav_html.py");
    const args = [legacy, pageUrl];
    if (acceptLanguage?.trim()) args.push(acceptLanguage);
    const child = spawn(config.pythonPath, args, {
      cwd: config.projectRoot,
      env: { ...process.env, PYTHONPATH: config.projectRoot, PYTHONUNBUFFERED: "1" },
    });
    const chunks: Buffer[] = [];
    let err = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => {
      err += c;
    });
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      reject(new Error(err.trim() || `fetch_missav_html 結束碼 ${code}`));
    });
  });
}

export async function fetchMissavHtmlViaPythonPool(
  pageUrl: string,
  acceptLanguage?: string
): Promise<string> {
  try {
    const workers = getPool();
    const w = workers[rr++ % workers.length];
    return await w.fetch(pageUrl, acceptLanguage);
  } catch {
    return fetchMissavHtmlViaPythonSpawn(pageUrl, acceptLanguage);
  }
}
