import { apiGet } from "../api/client";

export type DownloadQueueInfo = {
  concurrency: number;
  pendingJobs: number;
  runningJobs: number;
};

export type JobStatusResponse = {
  id: string;
  status: string;
  slug: string;
  filename?: string;
  message?: string;
  queue?: DownloadQueueInfo;
};

const POLL_MS = 1200;
const MAX_MS = 3600_000;

/** 輪詢直到 done / error / 逾時 / AbortSignal */
export async function pollDownloadUntilTerminal(
  jobId: string,
  options: {
    signal: AbortSignal;
    onStatus: (st: JobStatusResponse) => void;
    pollMs?: number;
  }
): Promise<"done" | "error" | "timeout" | "aborted"> {
  const pollMs = options.pollMs ?? POLL_MS;
  const deadline = Date.now() + MAX_MS;
  while (Date.now() < deadline) {
    if (options.signal.aborted) return "aborted";
    const st = await apiGet<JobStatusResponse>(`/api/downloads/${jobId}`);
    options.onStatus(st);
    if (st.status === "done") return "done";
    if (st.status === "error") return "error";
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return "timeout";
}
