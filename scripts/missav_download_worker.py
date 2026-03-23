#!/usr/bin/env python3
"""
長駐程序：stdin 每行一筆 JSON（jobId、pageUrl、outputPath、quality），
stdout 每行一筆 JSON 結果：{"ok":true,"jobId":"..."} 或 {"ok":false,"error":"...","jobId":"..."}

同一程序內重用 missav_api.Client，避免每次 MP4 下載都冷啟動 Python／重連 session。
下載過程中將 stdout 導向黑洞，避免函式庫 print 破壞 JSON 協定。
"""
from __future__ import annotations

import contextlib
import io
import json
import sys


def main() -> None:
    client = None

    def get_client():
        nonlocal client
        if client is None:
            from missav_api import Client

            client = Client()
        return client

    stdin = sys.stdin.buffer
    while True:
        raw = stdin.readline()
        if not raw:
            break
        raw = raw.strip()
        if not raw:
            continue
        req = json.loads(raw.decode("utf-8"))
        job_id = req.get("jobId", "")
        page_url = req["pageUrl"]
        output_path = req["outputPath"]
        quality = req.get("quality", "best")

        try:
            c = get_client()
            video = c.get_video(page_url)

            def silent_cb(_a, _b):
                pass

            sink = io.StringIO()
            with contextlib.redirect_stdout(sink):
                video.core.download(
                    video=video,
                    quality=quality,
                    downloader="threaded",
                    path=output_path,
                    callback=silent_cb,
                    remux=False,
                )
            sys.stdout.write(json.dumps({"ok": True, "jobId": job_id}) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(
                json.dumps({"ok": False, "error": str(e), "jobId": job_id}) + "\n"
            )
            sys.stdout.flush()


if __name__ == "__main__":
    main()
