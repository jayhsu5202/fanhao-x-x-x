import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";

type FeaturedRes = {
  recomms: RecommItem[];
  recomId: string | null;
  likelyEnd?: boolean;
  hasMore?: boolean;
};

const PAGE_SIZE = 32;
const MIN_FETCH_GAP_MS = 280;
/** 僅 tail 自動銜接：連續去重後 0 筆新卡片上限；使用者捲動讓 sentinel 再次進入視窗會歸零（見 loadMore source） */
const MAX_TAIL_ZERO_ADD_STREAK = 48;
/** 與下方 isSentinelInLoadZone 一致，預載距離 */
const LOAD_ZONE_PX = 900;

function docContentShort(extra = 280): boolean {
  const vh = window.innerHeight;
  const sh = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return sh <= vh + extra;
}

function appendUniqueById(prev: RecommItem[], batch: RecommItem[]): { next: RecommItem[]; added: number } {
  const seen = new Set(prev.map((x) => x.id));
  const add: RecommItem[] = [];
  for (const x of batch) {
    if (!x?.id || seen.has(x.id)) continue;
    seen.add(x.id);
    add.push(x);
  }
  if (add.length === 0) return { next: prev, added: 0 };
  return { next: [...prev, ...add], added: add.length };
}

function isSentinelInLoadZone(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return r.top < vh + LOAD_ZONE_PX && r.bottom > -LOAD_ZONE_PX;
}

function featuredUrl(limit: number, opts: { recommId?: string | null } = {}): string {
  const rid = opts.recommId?.trim();
  if (rid) {
    return `/api/featured?limit=${limit}&recommId=${encodeURIComponent(rid)}`;
  }
  return `/api/featured?limit=${limit}&fresh=1&_cb=${Date.now()}`;
}

export default function HomePage() {
  const { locale } = useMissavLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");

  const [items, setItems] = useState<RecommItem[]>([]);
  const [recommId, setRecommId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [featErr, setFeatErr] = useState<string | null>(null);
  const [canRecommendNext, setCanRecommendNext] = useState(false);

  const loadMoreLock = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const recommIdRef = useRef<string | null>(null);
  const canNextRef = useRef(false);
  const lastFetchEndRef = useRef(0);
  const feedGenRef = useRef(0);
  const itemsRef = useRef<RecommItem[]>([]);
  const zeroAddStreakRef = useRef(0);
  const initialLoadingRef = useRef(true);
  initialLoadingRef.current = initialLoading;
  const loadMoreRef = useRef<(o?: { source?: "intersect" | "shortPage" | "tail" }) => Promise<void>>(async () => {});

  itemsRef.current = items;
  recommIdRef.current = recommId;
  canNextRef.current = canRecommendNext;

  useEffect(() => {
    const legacy = searchParams.get("q")?.trim();
    if (legacy) {
      navigate(`/search?q=${encodeURIComponent(legacy)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    let cancelled = false;
    feedGenRef.current += 1;
    setFeatErr(null);
    setItems([]);
    setRecommId(null);
    setCanRecommendNext(false);
    setInitialLoading(true);
    loadMoreLock.current = false;
    zeroAddStreakRef.current = 0;

    apiGet<FeaturedRes>(featuredUrl(PAGE_SIZE))
      .then((d) => {
        if (cancelled) return;
        const batch = d.recomms ?? [];
        const rid = d.recomId ?? null;
        setItems(appendUniqueById([], batch).next);
        setRecommId(rid);
        setCanRecommendNext(Boolean(rid));
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setFeatErr(e instanceof Error ? e.message : "推薦載入失敗");
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const loadMore = useCallback(
    async (opts?: { source?: "intersect" | "shortPage" | "tail" }) => {
      if (loadMoreLock.current || initialLoading) return;
      if (Date.now() - lastFetchEndRef.current < MIN_FETCH_GAP_MS) return;
      if (opts?.source === "intersect" || opts?.source === "shortPage") {
        zeroAddStreakRef.current = 0;
      }

      const gen = feedGenRef.current;
      loadMoreLock.current = true;
      setLoadingMore(true);
      let fetchOk = false;
      try {
        const useNext = canNextRef.current && recommIdRef.current;
        const url = useNext
          ? featuredUrl(PAGE_SIZE, { recommId: recommIdRef.current })
          : featuredUrl(PAGE_SIZE);

        const d = await apiGet<FeaturedRes>(url);
        if (gen !== feedGenRef.current) return;

        fetchOk = true;
        setFeatErr(null);
        const batch = d.recomms ?? [];
        const { next, added: newUniqueCount } = appendUniqueById(itemsRef.current, batch);
        itemsRef.current = next;
        setItems(next);

        const rid = d.recomId ?? null;
        setRecommId(rid);

        if (useNext) {
          const dupOnly = batch.length > 0 && newUniqueCount === 0;
          const emptyBatch = batch.length === 0;
          if (emptyBatch || dupOnly || !rid) setCanRecommendNext(false);
          else setCanRecommendNext(true);
        } else {
          setCanRecommendNext(Boolean(rid));
        }

        if (newUniqueCount === 0) zeroAddStreakRef.current += 1;
        else zeroAddStreakRef.current = 0;
      } catch (e) {
        if (gen === feedGenRef.current && itemsRef.current.length > 0) {
          setFeatErr(e instanceof Error ? e.message : "載入更多失敗");
        }
      } finally {
        if (gen === feedGenRef.current) lastFetchEndRef.current = Date.now();
        loadMoreLock.current = false;
        setLoadingMore(false);
        /**
         * IO 只在「交集狀態改變」時觸發；若 sentinel 一直留在視窗內（例如整批去重後高度不變），
         * 必須在請求結束後主動檢查是否仍應繼續載入——這才是常見無限捲動做法。
         */
        if (fetchOk && gen === feedGenRef.current) {
          window.setTimeout(() => {
            if (feedGenRef.current !== gen || loadMoreLock.current || initialLoadingRef.current) return;
            if (zeroAddStreakRef.current > MAX_TAIL_ZERO_ADD_STREAK) return;
            const el = sentinelRef.current;
            if (el && isSentinelInLoadZone(el)) {
              void loadMoreRef.current({ source: "tail" });
            }
          }, MIN_FETCH_GAP_MS);
        }
      }
    },
    [initialLoading]
  );

  loadMoreRef.current = loadMore;

  const ready = !initialLoading;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !ready) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore({ source: "intersect" });
      },
      { root: null, rootMargin: `${LOAD_ZONE_PX}px 0px`, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready, loadMore, items.length]);

  useEffect(() => {
    if (!ready || loadingMore) return;
    if (!docContentShort(240)) return;
    void loadMore({ source: "shortPage" });
  }, [ready, loadingMore, items.length, loadMore]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    navigate(`/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <div className="page-shell home-missav">
      <SiteHeader />
      <header className="app-header app-header-hero">
        <p className="home-kicker">免費高清 · 本站聚合瀏覽</p>
        <h1 className="home-hero-title">
          搜尋任何<span className="home-hero-accent"> 日本AV</span>
        </h1>
        <div className="header-top">
          <span className="header-tag">搜尋 · 分類 · 詳情 · 播放 · 下載</span>
        </div>
        <form className="search-bar search-bar-hero" onSubmit={onSubmit} id="search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="例子：金髮、番號、女優名…"
            autoComplete="off"
            aria-label="搜尋"
            enterKeyHint="search"
          />
          <button type="submit">搜尋</button>
        </form>
        <p className="hero-sub">
          使用上方搜尋會前往<strong> 獨立搜尋頁 </strong>顯示結果。
          <strong> 語系按鈕 </strong>影響詳情與縮圖。熱門推薦往下滑會自動載入更多。
        </p>
      </header>
      <main className="main-pad">
        <section className="home-featured" aria-labelledby="feat-title">
          <div className="home-section-head">
            <h2 id="feat-title" className="home-section-title">
              熱門推薦
            </h2>
          </div>
          {featErr ? <p className="home-featured-warn">{featErr}</p> : null}
          {initialLoading ? (
            <div className="featured-matrix featured-matrix--home">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="featured-card-skel skeleton" />
              ))}
            </div>
          ) : null}
          {!initialLoading && items.length > 0 ? (
            <div className="featured-matrix featured-matrix--home" aria-busy={loadingMore}>
              {items.map((it) => (
                <div key={`${it.id}-${locale}`} className="featured-card-slot">
                  <VideoCard item={it} thumbLoading="lazy" showFavoriteHeart />
                </div>
              ))}
              <div
                ref={sentinelRef}
                className="featured-infinite-sentinel"
                aria-hidden
              />
            </div>
          ) : null}
          {!initialLoading && items.length === 0 && !featErr ? (
            <p className="msg-muted" style={{ padding: "1rem 0" }}>
              暫無推薦項目。
            </p>
          ) : null}

          {loadingMore ? (
            <div className="featured-matrix featured-matrix--home" style={{ marginTop: 12 }} aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`more-skel-${i}`} className="featured-card-skel skeleton" />
              ))}
            </div>
          ) : null}
        </section>

        <p className="footer-note">僅供合法授權內容使用；請遵守來源站與法律規範。</p>
      </main>
    </div>
  );
}
