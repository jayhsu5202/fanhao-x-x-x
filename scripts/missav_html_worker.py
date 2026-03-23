#!/usr/bin/env python3
"""
長駐程序：stdin 每行一筆 JSON（url、accept_language），stdout 回傳：
  成功：big-endian u32 長度 N（N>0）+ UTF-8 HTML 位元組
  失敗：u32 0 + u32 errLen + UTF-8 錯誤訊息

供 Node 程序池重用 Client／session，避免每次 fetch 都冷啟動 Python。
"""
from __future__ import annotations

import json
import struct
import sys
from urllib.parse import urlparse

from missav_api import Client


def main() -> None:
    client = Client()
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    while True:
        line = stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        req = json.loads(line.decode("utf-8"))
        url = req["url"]
        al = req.get("accept_language") or "en-US,en;q=0.9"
        try:
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc:
                client.core.session.headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
            client.core.session.headers["Accept-Language"] = al
            html = client.core.fetch(url)
            if isinstance(html, bytes):
                b = html
            else:
                b = html.encode("utf-8")
            if len(b) > 80 * 1024 * 1024:
                raise RuntimeError("html too large")
            stdout.write(struct.pack(">I", len(b)))
            stdout.write(b)
        except Exception as e:
            err = str(e).encode("utf-8")
            stdout.write(struct.pack(">I", 0))
            stdout.write(struct.pack(">I", len(err)))
            stdout.write(err)
        stdout.flush()


if __name__ == "__main__":
    main()
