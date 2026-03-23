#!/usr/bin/env python3
"""
掃描 Recombee（與 server/src/lib/recombee.ts、missav_api 同源）回傳的 recomms[].values 欄位。
執行：repo 根目錄  python3 scripts/dump_recombee_catalog_fields.py
輸出：stdout JSON；並寫入 docs/recombee-catalog-field-inventory.json
"""
from __future__ import annotations

import json
import sys
import time
import hmac
import hashlib
from pathlib import Path
from urllib.parse import quote
from urllib import request
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DOCS_JSON = ROOT / "docs" / "recombee-catalog-field-inventory.json"

TOKEN = "Ikkg568nlM51RHvldlPvc2GzZPE9R4XGzaH9Qj4zK9npbbbTly1gj9K4mgRn0QlV"
DB = "missav-default"
HOST = "https://client-rapi-missav.recombee.com"


def sign_path(api_path: str, token: str) -> str:
    ts = int(time.time())
    unsigned = f"/{DB}{api_path}"
    if "?" in unsigned:
        unsigned += f"&frontend_timestamp={ts}"
    else:
        unsigned += f"?frontend_timestamp={ts}"
    sig = hmac.new(token.encode("utf-8"), unsigned.encode("utf-8"), hashlib.sha1).hexdigest()
    return unsigned + f"&frontend_sign={sig}"


def http_post_json(path: str, body: dict) -> dict:
    signed = sign_path(path, TOKEN)
    url = f"{HOST}{signed}"
    data = json.dumps(body).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        method="POST",
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    with request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def http_get(path: str) -> dict:
    signed = sign_path(path, TOKEN)
    url = f"{HOST}{signed}"
    req = request.Request(url, method="GET", headers={"Accept": "application/json"})
    with request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def type_label(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int) and not isinstance(v, bool):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "str"
    if isinstance(v, list):
        if not v:
            return "list(empty)"
        return f"list[{type_label(v[0])}]"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__


def shorten(v: Any, n: int = 100) -> Any:
    if isinstance(v, str) and len(v) > n:
        return v[:n] + "…"
    if isinstance(v, list):
        return [shorten(x, 80) for x in v[:8]] + (["…"] if len(v) > 8 else [])
    if isinstance(v, dict):
        return {k: shorten(v[k], 60) for k in list(v.keys())[:12]}
    return v


def collect_recomms(samples: list[tuple[str, dict]]) -> list[dict]:
    out: list[dict] = []
    for label, data in samples:
        arr = data.get("recomms") or []
        for r in arr:
            if isinstance(r, dict) and r.get("id"):
                out.append(r)
    return out


def main() -> int:
    uid = quote("anonymous", safe="")
    searches = [
        ("search:麻豆傳媒", http_post_json(f"/search/users/{uid}/items/", {"searchQuery": "麻豆傳媒", "count": 20, "cascadeCreate": True, "returnProperties": True})),
        ("search:素人", http_post_json(f"/search/users/{uid}/items/", {"searchQuery": "素人", "count": 20, "cascadeCreate": True, "returnProperties": True})),
    ]
    featured = http_get(
        f"/recomms/users/{uid}/items/?count=20&cascadeCreate=true&returnProperties=true&rotationRate=0.12&rotationTime=7200"
    )
    samples = searches + [("featured:anonymous", featured)]
    recomms = collect_recomms(samples)

    key_meta: dict[str, dict[str, Any]] = {}
    for r in recomms:
        vals = r.get("values")
        if not isinstance(vals, dict):
            continue
        for k, v in vals.items():
            ent = key_meta.setdefault(k, {"types": set(), "example": None})
            ent["types"].add(type_label(v))
            if ent["example"] is None and v is not None and v != []:
                ent["example"] = shorten(v, 120)

    # serializable
    keys_out = {}
    for k in sorted(key_meta.keys()):
        ent = key_meta[k]
        keys_out[k] = {
            "types": sorted(ent["types"]),
            "example": ent["example"],
        }

    # 與 Recombee 無關：導覽對照用（瀏覽器實測 missav.ws，2026-03-23）。重跑 dump 會一併寫入。
    official_nav_reference: dict[str, Any] = {
        "verifiedAt": "2026-03-23",
        "defaultHost": "https://missav.ws",
        "notes": [
            "官網頁尾「影片／搜尋」多為固定路徑列表＋分頁，與本站 Recombee featured/search 不同源；筆數無法靠 values 欄位對齊。",
            "本站前端導覽僅 SPA（/search、/c/*）；下表 paths 僅供與官網對照，非導覽實作。",
            "繁中站實測 /search?q= 回 404；關鍵字搜尋可用 /cn?q=（例：FC2）。",
            "女優為 /actresses；/actors 為男優。/amateur、/uncensored 路徑為 404，勿當官網入口。",
            "類型「素人」可由 /genres/%E7%B4%A0%E4%BA%BA 進入（會轉到 /dm*/genres/…）。",
            "麻豆列表 /madou 會轉到 /dm35/madou。",
        ],
        "paths": {
            "recent": "/new",
            "release": "/release",
            "uncensored_leak": "/uncensored-leak",
            "chinese_subtitle": "/chinese-subtitle",
            "actresses": "/actresses",
            "genres_index": "/genres",
            "makers": "/makers",
            "genre_amateur": "/genres/%E7%B4%A0%E4%BA%BA",
            "search_fc2": "/cn?q=FC2",
            "madou": "/madou",
        },
    }

    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "recommTopLevelKeys": sorted({k for r in recomms for k in r.keys() if isinstance(r, dict)}),
        "valueKeyCount": len(keys_out),
        "valueKeys": keys_out,
        "sources": [s[0] for s in samples],
        "itemsSampled": len(recomms),
        "officialNavReference": official_nav_reference,
    }

    text = json.dumps(payload, ensure_ascii=False, indent=2)
    print(text)
    DOCS_JSON.parent.mkdir(parents=True, exist_ok=True)
    DOCS_JSON.write_text(text, encoding="utf-8")
    print(f"\n# wrote {DOCS_JSON}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
