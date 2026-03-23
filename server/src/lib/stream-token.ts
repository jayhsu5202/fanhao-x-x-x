import crypto from "node:crypto";

export type StreamTyp = "playlist" | "segment";

export type StreamPayload = {
  exp: number;
  target: string;
  typ: StreamTyp;
};

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const b64 = (s + (pad < 4 ? "=".repeat(pad) : "")).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function signStreamToken(secret: string, payload: StreamPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const payloadB64 = b64url(body);
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

export function verifyStreamToken(secret: string, token: string): StreamPayload {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new Error("invalid token format");
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("bad signature");
  }
  const raw = b64urlDecode(payloadB64).toString("utf8");
  const data = JSON.parse(raw) as StreamPayload;
  if (typeof data.exp !== "number" || typeof data.target !== "string" || !data.typ) {
    throw new Error("invalid payload");
  }
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error("token expired");
  if (!data.target.startsWith("https://") && !data.target.startsWith("http://")) {
    throw new Error("invalid target");
  }
  return data;
}
