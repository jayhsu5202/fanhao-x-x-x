import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../api/client";
import type { RecommItem } from "../components/VideoCard";

export type RecombeeFeedResponse = {
  recomms: RecommItem[];
  recomId?: string | null;
};

const MIN_FETCH_GAP_MS = 280;
const MAX_TAIL_ZERO_ADD_STREAK = 48;
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
  const r = d.recomId;
  return typeof r === "string" && r.length > 0 ? r : null;
}

/**
 * Recombee 列表無限捲動：IntersectionObserver + 請求結束後若 sentinel 仍在預載區則自動銜接（與首頁相同策略）。
 * URL 建構函式以 ref 讀取，避免父元件每次 render 新函式導致 effect 重跑。
 */
export function useInfiniteRecombeeFeed(options: {
  resetKey: string;
  enabled?: boolean;
  getInitialUrl: () => string;
  getMoreUrl: (ctx: { useNext: boolean; recommId: string | null }) => string;
  initialErrorLabel: string;
  loadMoreErrorLabel: string;
  /** 首屏 API 完整 JSON（例如分類頁要 label／description，避免再打第二支請求） */
  onInitialResponse?: (data: unknown) => void;
}) {
  const {
    resetKey,
    enabled = true,
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

  const [items, setItems] = useState<RecommItem[]>([]);
  const [recommId, setRecommId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    if (!enabled) {
      feedGenRef.current += 1;
      setItems([]);
      setRecommId(null);
      setCanRecommendNext(false);
      setInitialLoading(false);
      setErr(null);
      loadMoreLock.current = false;
      zeroAddStreakRef.current = 0;
      return;
    }

    let cancelled = false;
    feedGenRef.current += 1;
    setErr(null);
    setItems([]);
    setRecommId(null);
    setCanRecommendNext(false);
    setInitialLoading(true);
    loadMoreLock.current = false;
    zeroAddStreakRef.current = 0;

    const url = getInitialUrlRef.current();
    apiGet<RecombeeFeedResponse>(url)
      .then((d) => {
        if (cancelled) return;
        onInitialResponseRef.current?.(d);
        const batch = d.recomms ?? [];
        const rid = pickRid(d);
        setItems(appendUniqueById([], batch).next);
        setRecommId(rid);
        setCanRecommendNext(Boolean(rid));
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setErr(e instanceof Error ? e.message : initialErrorLabel);
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resetKey, enabled, initialErrorLabel]);

  const loadMore = useCallback(
    async (opts?: { source?: "intersect" | "shortPage" | "tail" }) => {
      if (!enabled) return;
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
          setErr(e instanceof Error ? e.message : loadMoreErrorLabel);
        }
      } finally {
        if (gen === feedGenRef.current) lastFetchEndRef.current = Date.now();
        loadMoreLock.current = false;
        setLoadingMore(false);
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
    [enabled, initialLoading, loadMoreErrorLabel]
  );

  loadMoreRef.current = loadMore;

  const ready = enabled && !initialLoading;

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

  return {
    items,
    initialLoading,
    loadingMore,
    err,
    sentinelRef,
  };
}
