import { Agent, fetch as undiciFetch } from "undici";
import { config } from "../config.js";

const upstreamAgent = new Agent({
  allowH2: config.upstreamHttp2Enabled,
  connections: config.upstreamConnectionsPerOrigin,
  keepAliveTimeout: config.upstreamKeepAliveTimeoutMs,
  keepAliveMaxTimeout: config.upstreamKeepAliveTimeoutMs,
});

export function upstreamFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Awaited<ReturnType<typeof undiciFetch>>> {
  return undiciFetch(input, {
    ...init,
    dispatcher: upstreamAgent,
  } as Parameters<typeof undiciFetch>[1]);
}
