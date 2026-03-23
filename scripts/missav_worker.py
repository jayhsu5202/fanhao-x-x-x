#!/usr/bin/env python3
"""
讀取 stdin 一行 JSON：{"pageUrl","outputPath","quality"}
使用 missav_api 取得影片並以 eaf_base_api BaseCore.download 下載（threaded）。

註：missav_api.Video.download 目前與已安裝 eaf_base_api 的 BaseCore.download 簽名不相容，
故改呼叫 video.core.download(..., downloader="threaded", ...)。
"""
from __future__ import annotations

import json
import sys


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("empty stdin", file=sys.stderr)
        return 1
    req = json.loads(raw)
    page_url = req["pageUrl"]
    output_path = req["outputPath"]
    quality = req.get("quality", "best")

    from missav_api import Client

    def silent_cb(_a, _b):
        pass

    client = Client()
    video = client.get_video(page_url)
    video.core.download(
        video=video,
        quality=quality,
        downloader="threaded",
        path=output_path,
        callback=silent_cb,
        remux=False,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)
