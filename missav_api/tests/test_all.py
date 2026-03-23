"""
整合測試：需網路與 Recombee（與 missav_api.py、server 同源 token／DB）。
與 `server/src/lib/recombee-catalog-filters.ts` 的 ReQL 字串應同步。

原則：禁止「只檢型別／只抽樣一兩筆就過」；成功回應不得含 `error`；
`recommId` 鍵名與後端 pickRecomId 來源一致（Recombee 回 `recommId`，不是 `recomId`）。
"""

import pytest

from ..missav_api import Client

# 與 server/src/lib/recombee-catalog-filters.ts 一致（變更時請兩邊一起改）
RECOMBEE_FILTER_UNCENSORED = "'is_uncensored_leak' == true or 'type' == \"uncensored-leak\""
RECOMBEE_FILTER_AMATEUR = "(\"素人\" in 'genres') or (\"素人\" in 'tags')"


@pytest.fixture(scope="module")
def client() -> Client:
    return Client()


@pytest.fixture(scope="module")
def sample_video(client: Client):
    return client.get_video("https://missav.ws/dm13/de/fc2-ppv-2777644")


def test_video_attributes(sample_video):
    v = sample_video
    assert isinstance(v.title, str) and len(v.title.strip()) > 0
    assert isinstance(v.publish_date, str) and len(v.publish_date.strip()) > 0
    assert isinstance(v.m3u8_base_url, str) and v.m3u8_base_url.startswith("http")
    assert isinstance(v.video_code, str) and len(v.video_code.strip()) > 0
    assert isinstance(v.thumbnail, str) and v.thumbnail.startswith("http")


def test_search_stepdaughter_batch_matches_recombee_count_and_titles(client: Client):
    """search() 必須與同一請求的 recomms 筆數一致，且每部都有非空標題（真的打到 Recombee + MissAV）。"""
    n = 10
    raw = client.recombee_search_items("stepdaughter", count=n)
    assert "error" not in raw
    assert "recommId" in raw and isinstance(raw["recommId"], str) and len(raw["recommId"]) > 0
    assert "recomId" not in raw, "Recombee 不回傳 recomId（少一個 m），勿寬鬆相容誤判"
    recomms = raw["recomms"]
    assert isinstance(recomms, list)
    assert len(recomms) == n, f"要求 {n} 筆，實際 {len(recomms)}"
    for r in recomms:
        assert isinstance(r.get("id"), str) and len(r["id"]) > 0

    videos = list(client.search("stepdaughter", video_count=n))
    assert len(videos) == len(recomms), "Generator 產出數量須與 Recombee recomms 一致"
    for v in videos:
        assert isinstance(v.title, str) and len(v.title.strip()) > 0


def test_recombee_invalid_filter_raises(client: Client):
    """無效 ReQL 必須失敗，禁止靜默當成功。"""
    with pytest.raises(RuntimeError, match="Recombee SearchItems failed"):
        client.recombee_search_items(
            "x",
            count=5,
            filter_expr="'this_property_does_not_exist_zzz' == true",
        )


def _passes_uncensored(vals: dict) -> bool:
    if vals.get("is_uncensored_leak") is True:
        return True
    typ = str(vals.get("type") or "").lower()
    return "uncensored-leak" in typ


def _passes_amateur(vals: dict) -> bool:
    genres = vals.get("genres") or []
    tags = vals.get("tags") or []
    g = any(isinstance(x, str) and "素人" in x for x in genres)
    t = any(isinstance(x, str) and "素人" in x for x in tags)
    return g or t


def test_uncensored_filter_every_recomm_in_batch_matches_catalog_rule(client: Client):
    """有 filter 時：本批每一筆 values 都須滿足無碼條件（不是只抽前 5 筆）。"""
    count = 20
    data = client.recombee_search_items(
        "無碼",
        count=count,
        filter_expr=RECOMBEE_FILTER_UNCENSORED,
    )
    recomms = data["recomms"]
    assert len(recomms) >= 15, f"預期至少 15 筆，實際 {len(recomms)}（catalog 或網路異常）"
    bad = [r["id"] for r in recomms if not _passes_uncensored(r.get("values") or {})]
    assert bad == [], f"filter 下仍混入不符合條件 id（前 20 個）: {bad}"


def test_uncensored_filtered_batch_is_subset_semantics_stricter_than_unfiltered(client: Client):
    """無 filter 的同一關鍵字下，應存在至少一筆不符合無碼條件（對照組）；有 filter 則全符合。"""
    count = 20
    plain = client.recombee_search_items("無碼", count=count)
    plain_recomms = plain["recomms"]
    assert len(plain_recomms) >= 10
    plain_bad = [r["id"] for r in plain_recomms if not _passes_uncensored(r.get("values") or {})]

    filt = client.recombee_search_items(
        "無碼",
        count=count,
        filter_expr=RECOMBEE_FILTER_UNCENSORED,
    )
    filt_bad = [r["id"] for r in filt["recomms"] if not _passes_uncensored(r.get("values") or {})]
    assert filt_bad == []

    assert len(plain_bad) >= 1, (
        "對照組：純搜尋「無碼」應混有非 is_uncensored_leak／非 uncensored-leak type 的筆；"
        f"若全符合則此測試無法驗證 filter 是否生效（plain_bad={plain_bad}）"
    )


def test_amateur_filter_every_recomm_in_batch_matches_catalog_rule(client: Client):
    count = 20
    data = client.recombee_search_items(
        "素人",
        count=count,
        filter_expr=RECOMBEE_FILTER_AMATEUR,
    )
    recomms = data["recomms"]
    assert len(recomms) >= 15
    bad = [r["id"] for r in recomms if not _passes_amateur(r.get("values") or {})]
    assert bad == [], f"filter 下仍混入 genres/tags 無「素人」: {bad}"
