#!/usr/bin/env python3
"""
以 missav_api 的 BaseCore.fetch 抓取影片頁 HTML，與函式庫行為一致（含 httpx session、HTTP/1.1 等）。
供 Node 後端解析用；避免 Node undici/fetch 被 missav.ws 回 403。
"""
from __future__ import annotations

import sys
from urllib.parse import urlparse

from missav_api import Client


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: fetch_missav_html.py <page_url>", file=sys.stderr)
        return 1
    url = sys.argv[1]
    client = Client()
    if len(sys.argv) >= 3 and sys.argv[2].strip():
        client.core.session.headers["Accept-Language"] = sys.argv[2]
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        client.core.session.headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
    html = client.core.fetch(url)
    if isinstance(html, bytes):
        sys.stdout.buffer.write(html)
    else:
        sys.stdout.write(html)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)
