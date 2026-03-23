import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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

const PAGE_SIZE = 80;
const MIN_FETCH_GAP_MS = 320;

function docNearBottom(px: number): boolean {
  const scrollTop =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const vh = window.innerHeight;
  const sh = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return sh - scrollTop - vh < px;
}

function docContentShort(extra = 280): boolean {
  const vh = window.innerHeight;
  const sh = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return sh <= vh + extra;
}

function appendUniqueById(prev: RecommItem[], batch: RecommItem[]): { next: RecommItem[]; added: number } {
  const seen = new Set(prev.map((x) => x.id));
  const add = batch.filter((x) => x?.id && !seen.has(x.id));
  if (add.length === 0) return { next: prev, added: 0 };
  return { next: [...prev, ...add], added: add.length };
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
    setFeatErr(null);
    setItems([]);
    setRecommId(null);
    setCanRecommendNext(false);
    setInitialLoading(true);
    loadMoreLock.current = false;

    apiGet<FeaturedRes>(`/api/featured?limit=${PAGE_SIZE}`)
      .then((d) => {
        if (cancelled) return;
        const batch = d.recomms ?? [];
        const rid = d.recomId ?? null;
        setItems(batch);
        setRecommId(rid);
        const hm =
          typeof d.hasMore === "boolean"
            ? d.hasMore
            : Boolean(rid || batch.length > 0);
        setCanRecommendNext(Boolean(rid && hm));
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

  const loadMore = useCallback(async () => {
    if (loadMoreLock.current || initialLoading) return;
    if (Date.now() - lastFetchEndRef.current < MIN_FETCH_GAP_MS) return;

    loadMoreLock.current = true;
    setLoadingMore(true);
    try {
      const useNext = canNextRef.current && recommIdRef.current;
      const url = useNext
        ? `/api/featured?limit=${PAGE_SIZE}&recommId=${encodeURIComponent(recommIdRef.current!)}`
        : `/api/featured?limit=${PAGE_SIZE}&fresh=1`;

      const d = await apiGet<FeaturedRes>(url);
      setFeatErr(null);

      const batch = d.recomms ?? [];
      let newUniqueCount = 0;
      flushSync(() => {
        setItems((prev) => {
          const { next, added } = appendUniqueById(prev, batch);
          newUniqueCount = added;
          return next;
        });
      });

      const rid = d.recomId ?? null;
      setRecommId(rid);
      const serverHasMore =
        typeof d.hasMore === "boolean"
          ? d.hasMore
          : Boolean(rid || batch.length > 0);

      // 同一串若整包都是已看過的 id，改走 fresh；有 recommId 且本次有新增或上游仍給 id 則繼續 next
      if (useNext) {
        const dupOnly = batch.length > 0 && newUniqueCount === 0;
        if (batch.length === 0 || dupOnly || !rid || !serverHasMore) {
          setCanRecommendNext(false);
        } else {
          setCanRecommendNext(true);
        }
      } else {
        setCanRecommendNext(Boolean(rid && serverHasMore));
      }
    } catch (e) {
      console.warn("[featured loadMore]", e);
    } finally {
      lastFetchEndRef.current = Date.now();
      loadMoreLock.current = false;
      setLoadingMore(false);
    }
  }, [initialLoading]);

  const ready = !initialLoading;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !ready) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root: null, rootMargin: "1200px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready, loadMore, items.length]);

  useEffect(() => {
    if (!ready) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (loadMoreLock.current) return;
        if (docNearBottom(1400)) void loadMore();
      }, 48);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(t);
    };
  }, [ready, loadMore, items.length]);

  useEffect(() => {
    if (!ready || loadingMore) return;
    if (!docContentShort(240)) return;
    void loadMore();
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
          <strong> 語系按鈕 </strong>影響詳情與縮圖。熱門推薦可往下滑載入更多（同一 <code className="inline-code">recommId</code> 續載，必要時 <code className="inline-code">fresh=1</code> 新串）。
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
                  <VideoCard item={it} />
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
