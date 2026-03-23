import { signStreamToken, type StreamTyp } from "./stream-token.js";

function resolveUrl(base: string, ref: string): string {
  try {
    return new URL(ref, base).href;
  } catch {
    return ref;
  }
}

function guessTyp(abs: string): StreamTyp {
  const u = abs.split("?")[0].toLowerCase();
  if (u.endsWith(".m3u8")) return "playlist";
  return "segment";
}

/**
 * Rewrite playlist so all media / sub-playlist URLs go through our proxy.
 */
function streamProxyHref(publicBase: string, token: string): string {
  const base = publicBase.replace(/\/$/, "");
  const q = `api/stream?token=${token}`;
  return base ? `${base}/${q}` : `/${q}`;
}

export function rewritePlaylist(
  body: string,
  playlistUrl: string,
  secret: string,
  publicBase: string,
  defaultExp: number
): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  const sign = (abs: string, typ: StreamTyp) =>
    signStreamToken(secret, { exp: defaultExp, target: abs, typ });

  for (let line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('URI="')) {
      out.push(
        line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          const abs = resolveUrl(playlistUrl, uri);
          const tok = encodeURIComponent(sign(abs, guessTyp(abs)));
          return `URI="${streamProxyHref(publicBase, tok)}"`;
        })
      );
      continue;
    }

    if (!trimmed || trimmed.startsWith("#")) {
      out.push(line);
      continue;
    }

    const abs = resolveUrl(playlistUrl, trimmed);
    const typ = guessTyp(abs);
    const tok = encodeURIComponent(sign(abs, typ));
    out.push(streamProxyHref(publicBase, tok));
  }

  return out.join("\n");
}
