import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../api/client";
import type { RecommItem } from "../components/VideoCard";
import { clearFeedCache, readFeedCache, writeFeedCache } from "../lib/feedCache";

export type RecombeeFeedResponse = {
  recomms: RecommItem[];
  /** 本站 API 統一回傳鍵名；另相容 Recombee 原始鍵 `recommId` */
  recomId?: string | null;
  recommId?: string | null;
  /** 後端依 Recombee 本批筆數與 recommId 計算；false 時前端不得再請求 */
  hasMore?: boolean;
};

const MIN_FETCH_GAP_MS = 280;
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

function pickRid(d: RecombeeFeedResponse): string | null {
  const r = d.recomId ?? d.recommId;
  return typeof r === "string" && r.length > 0 ? r : null;
}

/** 與後端 recombeeHasMorePages 一致；舊版 API 無 hasMore 時用同規則推斷 */
function readHasMore(d: RecombeeFeedResponse, _pageSize: number): boolean {
  if (typeof d.hasMore === "boolean") return d.hasMore;
  const len = d.recomms?.length ?? 0;
  const rid = pickRid(d);
  return len > 0 || Boolean(rid);
}

/**
 * 無限捲動：後端 hasMore 為 false 時停止一切自動載入（IO／tail／短頁填滿）。
 */
export function useInfiniteRecombeeFeed(options: {
  pageSize: number;
  resetKey: string;
  enabled?: boolean;
  cacheKey?: string;
  getInitialUrl: () => string;
  getMoreUrl: (ctx: { useNext: boolean; recommId: string | null }) => string;
  initialErrorLabel: string;
  loadMoreErrorLabel: string;
  onInitialResponse?: (data: unknown) => void;
}) {
  const {
    pageSize,
    resetKey,
    enabled = true,
    cacheKey,
    getInitialUrl,
    getMoreUrl,
    initialErrorLabel,
    loadMoreErrorLabel,
    onInitialResponse,
  } = options;

  const getInitialUrlRef = useRef(getInitialUrl);
  const getMoreUrlRef = useRef(getMoreUrl);
  const onInitialResponseRef = useRef(onInitialResponse);
  getInitialUrlRef.current = getInitialUrl;
  getMoreUrlRef.current = getMoreUrl;
  onInitialResponseRef.current = onInitialResponse;

  // 若 cacheKey 存在且 cache 命中，直接從 cache 還原（跳過首次 fetch）
  const initFromCache = cacheKey ? readFeedCache(cacheKey) : null;

  const [items, setItems] = useState<RecommItem[]>(initFromCache?.items ?? []);
  const [recommId, setRecommId] = useState<string | null>(initFromCache?.recommId ?? null);
  const [initialLoading, setInitialLoading] = useState(!initFromCache);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canRecommendNext, setCanRecommendNext] = useState(initFromCache ? Boolean(initFromCache.recommId) : false);
  const [feedHasMore, setFeedHasMore] = useState(true);

  const loadMoreLock = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const recommIdRef = useRef<string | null>(null);
  const canNextRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastFetchEndRef = useRef(0);
  const feedGenRef = useRef(0);
  const itemsRef = useRef<RecommItem[]>([]);
  const initialLoadingRef = useRef(true);
  initialLoadingRef.current = initialLoading;
  const loadMoreRef = useRef<(o?: { source?: "intersect" | "shortPage" | "tail" }) => Promise<void>>(async () => {});

  itemsRef.current = items;
  recommIdRef.current = recommId;
  canNextRef.current = canRecommendNext;

  // cacheKey 變化時清除舊 cache（resetKey 改變也會觸發下面的 effect 重跑）
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  // 離開頁面前把目前 items + recommId 寫入 cache
  useEffect(() => {
    if (!cacheKey) return;
    return () => {
      writeFeedCache(cacheKey, {
        items: itemsRef.current,
        recommId: recommIdRef.current,
      });
    };
  }, [cacheKey]);

  // 追蹤是否為首次 mount（用於 cache 命中時跳過初始 fetch）
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      feedGenRef.current += 1;
      setItems([]);
      setRecommId(null);
      setCanRecommendNext(false);
      setFeedHasMore(true);
      hasMoreRef.current = true;
      setInitialLoading(false);
      setErr(null);
      loadMoreLock.current = false;
      isFirstRenderRef.current = false;
      return;
    }

    // 首次 mount 且 cache 命中：直接使用 cache，不發 fetch
    if (isFirstRenderRef.current && initFromCache) {
      isFirstRenderRef.current = false;
      hasMoreRef.current = true;
      return;
    }
    isFirstRenderRef.current = false;

    // resetKey 改變時清除 cache，強制重新 fetch
    if (cacheKeyRef.current) clearFeedCache(cacheKeyRef.current);

    // 嘗試從 sessionStorage cache 還原（首次 mount 時 initFromCache 已處理，
    // 但 resetKey 改變時必須清空並重新 fetch，所以這裡直接走 fetch 路徑）
    let cancelled = false;
    feedGenRef.current += 1;
    setErr(null);
    setItems([]);
    setRecommId(null);
    setCanRecommendNext(false);
    setFeedHasMore(true);
    hasMoreRef.current = true;
    setInitialLoading(true);
    loadMoreLock.current = false;

    const url = getInitialUrlRef.current();
    apiGet<RecombeeFeedResponse>(url)
      .then((d) => {
        if (cancelled) return;
        onInitialResponseRef.current?.(d);
        const batch = d.recomms ?? [];
        const rid = pickRid(d);
        const hm = readHasMore(d, pageSize);
        hasMoreRef.current = hm;
        setFeedHasMore(hm);
        setItems(appendUniqueById([], batch).next);
        setRecommId(rid);
        setCanRecommendNext(hm && Boolean(rid));
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setErr(e instanceof Error ? e.message : initialErrorLabel);
          hasMoreRef.current = false;
          setFeedHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resetKey, enabled, initialErrorLabel, pageSize]);

  const loadMore = useCallback(
    async (opts?: { source?: "intersect" | "shortPage" | "tail" }) => {
      if (!enabled) return;
      if (!hasMoreRef.current) return;
      if (loadMoreLock.current || initialLoading) return;
      if (Date.now() - lastFetchEndRef.current < MIN_FETCH_GAP_MS) return;

      const gen = feedGenRef.current;
      loadMoreLock.current = true;
      setLoadingMore(true);
      let fetchOk = false;
      try {
        const useNext = !!(canNextRef.current && recommIdRef.current);
        const url = getMoreUrlRef.current({
          useNext,
          recommId: recommIdRef.current,
        });
        const d = await apiGet<RecombeeFeedResponse>(url);
        if (gen !== feedGenRef.current) return;

        fetchOk = true;
        setErr(null);
        const batch = d.recomms ?? [];
        const { next, added: newUniqueCount } = appendUniqueById(itemsRef.current, batch);
        itemsRef.current = next;
        setItems(next);

        const rid = pickRid(d);
        const hm = readHasMore(d, pageSize);
        hasMoreRef.current = hm;
        setFeedHasMore(hm);
        setRecommId(rid);

        if (!hm) {
          setCanRecommendNext(false);
        } else if (useNext) {
          const dupOnly = batch.length > 0 && newUniqueCount === 0;
          const emptyBatch = batch.length === 0;
          if (emptyBatch || dupOnly || !rid) setCanRecommendNext(false);
          else setCanRecommendNext(true);
        } else {
          const dupOnly = batch.length > 0 && newUniqueCount === 0;
          const emptyBatch = batch.length === 0;
          if (emptyBatch || dupOnly) {
            hasMoreRef.current = false;
            setFeedHasMore(false);
            setCanRecommendNext(false);
          } else {
            setCanRecommendNext(Boolean(rid));
          }
        }
      } catch (e) {
        if (gen === feedGenRef.current && itemsRef.current.length > 0) {
          setErr(e instanceof Error ? e.message : loadMoreErrorLabel);
        }
        hasMoreRef.current = false;
        setFeedHasMore(false);
        setCanRecommendNext(false);
      } finally {
        if (gen === feedGenRef.current) lastFetchEndRef.current = Date.now();
        loadMoreLock.current = false;
        setLoadingMore(false);
        if (fetchOk && gen === feedGenRef.current && hasMoreRef.current) {
          window.setTimeout(() => {
            if (feedGenRef.current !== gen || loadMoreLock.current || initialLoadingRef.current) return;
            if (!hasMoreRef.current) return;
            const el = sentinelRef.current;
            if (el && isSentinelInLoadZone(el)) {
              void loadMoreRef.current({ source: "tail" });
            }
          }, MIN_FETCH_GAP_MS);
        }
      }
    },
    [enabled, initialLoading, loadMoreErrorLabel, pageSize]
  );

  loadMoreRef.current = loadMore;

  const ready = enabled && !initialLoading;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !ready || !hasMoreRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!hasMoreRef.current) return;
        if (entries[0]?.isIntersecting) void loadMore({ source: "intersect" });
      },
      { root: null, rootMargin: `${LOAD_ZONE_PX}px 0px`, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready, loadMore, feedHasMore]);

  useEffect(() => {
    if (!ready || loadingMore || !hasMoreRef.current) return;
    if (!docContentShort(240)) return;
    void loadMore({ source: "shortPage" });
  }, [ready, loadingMore, items.length, loadMore, feedHasMore]);

  return {
    items,
    initialLoading,
    loadingMore,
    err,
    sentinelRef,
    /** 後端宣告尚可能有下一頁；false 時請勿再觸發載入 */
    feedHasMore,
  };
}
