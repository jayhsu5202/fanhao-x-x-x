import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  apiGet,
  apiPost,
  downloadFileUrl,
  resolveMediaUrl,
  thumbnailUrlForSlug,
  triggerSaveAsDownload,
} from "../api/client";
import { pollDownloadUntilTerminal, type DownloadQueueInfo, type JobStatusResponse } from "../lib/downloadPoll";
import { clearActiveDownload, readActiveDownload, saveActiveDownload } from "../lib/downloadSession";
import FavoriteHeart from "../components/FavoriteHeart";
import SiteHeader from "../components/SiteHeader";
import { useMissavLocale } from "../context/MissavLocaleContext";
import VideoCard, { type RecommItem } from "../components/VideoCard";

type VideoDetail = {
  slug: string;
  page_url: string;
  title: string;
  video_code: string;
  publish_date: string;
  thumbnail: string;
  title_original_japanese: string;
  genres: string[];
  series: string;
  manufacturer: string;
  etiquette: string;
  m3u8_play_url: string;
  stream_token?: string;
};

type JobRes = { jobId: string; reused?: boolean };

type BySlugRes = {
  ready: boolean;
  active: boolean;
  jobId: string | null;
  status: string | null;
  filename: string | null;
};

type RecRes = { recomms: RecommItem[] };
type HealthRes = { downloadQueueConcurrency?: number };
type FavStatusRes = { favorited: boolean };

type DownloadUi =
  | { mode: "idle" }
  | {
      mode: "working";
      jobId: string;
      serverStatus: "pending" | "running";
      startedAt: number;
      queue?: DownloadQueueInfo;
    }
  | { mode: "ready"; jobId: string; filename?: string }
  | { mode: "error"; message: string };

function downloadStatusLine(s: "pending" | "running"): string {
  if (s === "pending") return "等待伺服器佇列處理…";
  return "正在下載並合併為 MP4（後端未提供百分比，請耐心等候）…";
}

export default function VideoPage() {
  const { locale } = useMissavLocale();
  const { slug = "" } = useParams<{ slug: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [data, setData] = useState<VideoDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quality] = useState("best");
  const [dlUi, setDlUi] = useState<DownloadUi>({ mode: "idle" });
  /** 每秒遞增，讓「已等待 N 秒」在輪詢期間會更新 */
  const [dlTick, setDlTick] = useState(0);
  const [related, setRelated] = useState<RecommItem[] | null>(null);
  const [dlConcurrency, setDlConcurrency] = useState<number | null>(null);
  /** 按下播放後才掛載 HLS，避免進頁就拉 m3u8／分片 */
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [playerErr, setPlayerErr] = useState<string | null>(null);
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  /** 使用者按下「下載」後略過尚未完成的進頁查詢結果，避免蓋掉進行中狀態 */
  const downloadKickRef = useRef(0);

  const posterUrl = data ? thumbnailUrlForSlug(data.slug, locale) : "";

  function abortDownloadPoll() {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  }

  useEffect(() => {
    if (dlUi.mode !== "working") return;
    const id = window.setInterval(() => setDlTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [dlUi.mode]);

  useEffect(() => {
    void apiGet<HealthRes>("/api/health")
      .then((h) => setDlConcurrency(typeof h.downloadQueueConcurrency === "number" ? h.downloadQueueConcurrency : 1))
      .catch(() => setDlConcurrency(1));
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (el && posterUrl) el.setAttribute("poster", posterUrl);
  }, [posterUrl]);

  useEffect(() => {
    setPlaybackStarted(false);
    setPlayerErr(null);
    setFavorited(null);
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    apiGet<FavStatusRes>(`/api/favorites/status/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!cancelled) setFavorited(Boolean(r.favorited));
      })
      .catch(() => {
        if (!cancelled) setFavorited(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setRelated(null);
    apiGet<VideoDetail>(`/api/videos/${encodeURIComponent(slug)}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "載入失敗");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  useEffect(() => {
    if (!slug || !data) return;
    let cancelled = false;
    apiGet<RecRes>(`/api/recommendations?itemId=${encodeURIComponent(slug)}&limit=14`)
      .then((r) => {
        if (!cancelled) setRelated(r.recomms ?? []);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, data, locale]);

  /**
   * 須在使用者點擊的同步堆疊內呼叫 play()（尤其 iOS Safari），不可等到 useEffect／MANIFEST_PARSED 才 play。
   */
  function attachStreamAndPlayFromUserGesture(el: HTMLVideoElement, url: string): void {
    setPlayerErr(null);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        xhrSetup(xhr) {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(el);
      const tryPlay = () => {
        void el.play().catch(() => {});
      };
      tryPlay();
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      return;
    }

    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = url;
      void el.play().catch(() => {});
      return;
    }

    setPlayerErr("此瀏覽器無法播放 HLS");
  }

  useEffect(() => {
    downloadKickRef.current = 0;
  }, [slug]);

  /**
   * 影片資料就緒後：先問伺服器是否已有此 slug 的完成檔或進行中工作；
   * 若無，再讀 session jobId（重新整理續傳）。服務重啟後 job 不在記憶體則無法還原，需重新排隊。
   */
  useEffect(() => {
    if (!slug || loading || !data || data.slug !== slug) return;

    abortDownloadPoll();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    let cancelled = false;

    void (async () => {
      const kickAtFetch = downloadKickRef.current;
      try {
        let by: BySlugRes;
        try {
          by = await apiGet<BySlugRes>(
            `/api/downloads/by-slug/${encodeURIComponent(slug)}?quality=${encodeURIComponent(quality)}`
          );
        } catch {
          return;
        }
        if (cancelled || ac.signal.aborted || downloadKickRef.current !== kickAtFetch) return;

        if (by.ready && by.jobId) {
          clearActiveDownload(slug);
          setDlUi({
            mode: "ready",
            jobId: by.jobId,
            filename: by.filename ?? undefined,
          });
          return;
        }

        if (by.active && by.jobId) {
          const startedAt = Date.now();
          saveActiveDownload(slug, by.jobId, startedAt);
          setDlTick(0);
          setDlUi({
            mode: "working",
            jobId: by.jobId,
            serverStatus: by.status === "running" ? "running" : "pending",
            startedAt,
          });
          const result = await pollDownloadUntilTerminal(by.jobId, {
            signal: ac.signal,
            onStatus: (st) => {
              if (ac.signal.aborted) return;
              if (st.status === "pending" || st.status === "running") {
                setDlUi({
                  mode: "working",
                  jobId: by.jobId!,
                  serverStatus: st.status === "running" ? "running" : "pending",
                  startedAt,
                  queue: st.queue,
                });
              }
            },
          });
          if (cancelled || ac.signal.aborted || downloadKickRef.current !== kickAtFetch) return;
          if (result === "done") {
            clearActiveDownload(slug);
            let fn: string | undefined;
            try {
              const st = await apiGet<JobStatusResponse>(`/api/downloads/${by.jobId}`);
              fn = st.filename;
            } catch {
              fn = undefined;
            }
            setDlUi({ mode: "ready", jobId: by.jobId, filename: fn });
            return;
          }
          if (result === "error") {
            clearActiveDownload(slug);
            try {
              const st = await apiGet<JobStatusResponse>(`/api/downloads/${by.jobId}`);
              setDlUi({ mode: "error", message: st.message || "下載失敗" });
            } catch {
              setDlUi({ mode: "error", message: "下載失敗" });
            }
            return;
          }
          if (result === "timeout") {
            clearActiveDownload(slug);
            setDlUi({ mode: "error", message: "等待逾時（超過 1 小時），請稍後重試或檢查伺服器暫存目錄。" });
          }
          return;
        }

        const saved = readActiveDownload(slug);
        if (!saved?.jobId) return;

        let first: JobStatusResponse;
        try {
          first = await apiGet<JobStatusResponse>(`/api/downloads/${saved.jobId}`);
        } catch {
          clearActiveDownload(slug);
          return;
        }
        if (cancelled || ac.signal.aborted || downloadKickRef.current !== kickAtFetch) return;
        if (first.slug !== slug) {
          clearActiveDownload(slug);
          return;
        }
        if (first.status === "done") {
          clearActiveDownload(slug);
          setDlUi({
            mode: "ready",
            jobId: saved.jobId,
            filename: first.filename,
          });
          return;
        }
        if (first.status === "error") {
          clearActiveDownload(slug);
          setDlUi({ mode: "error", message: first.message || "下載失敗" });
          return;
        }
        if (first.status !== "pending" && first.status !== "running") {
          clearActiveDownload(slug);
          return;
        }
        setDlTick(0);
        setDlUi({
          mode: "working",
          jobId: saved.jobId,
          serverStatus: first.status === "running" ? "running" : "pending",
          startedAt: saved.startedAt,
          queue: first.queue,
        });
        const result = await pollDownloadUntilTerminal(saved.jobId, {
          signal: ac.signal,
          onStatus: (st) => {
            if (ac.signal.aborted) return;
            if (st.status === "pending" || st.status === "running") {
              setDlUi({
                mode: "working",
                jobId: saved.jobId,
                serverStatus: st.status === "running" ? "running" : "pending",
                startedAt: saved.startedAt,
                queue: st.queue,
              });
            }
          },
        });
        if (cancelled || ac.signal.aborted || downloadKickRef.current !== kickAtFetch) return;
        if (result === "done") {
          clearActiveDownload(slug);
          let fn: string | undefined;
          try {
            const st = await apiGet<JobStatusResponse>(`/api/downloads/${saved.jobId}`);
            fn = st.filename;
          } catch {
            fn = undefined;
          }
          setDlUi({ mode: "ready", jobId: saved.jobId, filename: fn });
          return;
        }
        if (result === "error") {
          clearActiveDownload(slug);
          try {
            const st = await apiGet<JobStatusResponse>(`/api/downloads/${saved.jobId}`);
            setDlUi({ mode: "error", message: st.message || "下載失敗" });
          } catch {
            setDlUi({ mode: "error", message: "下載失敗" });
          }
          return;
        }
        if (result === "timeout") {
          clearActiveDownload(slug);
          setDlUi({ mode: "error", message: "等待逾時（超過 1 小時），請稍後重試或檢查伺服器暫存目錄。" });
        }
      } finally {
        if (pollAbortRef.current === ac) pollAbortRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      if (pollAbortRef.current === ac) pollAbortRef.current = null;
    };
  }, [slug, quality, loading, data?.slug]);

  async function startDownload() {
    if (!slug || dlUi.mode === "working") return;
    downloadKickRef.current += 1;
    abortDownloadPoll();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    const startedAt = Date.now();
    setDlTick(0);
    setDlUi({ mode: "working", jobId: "", serverStatus: "pending", startedAt });
    try {
      const res = await apiPost<JobRes>("/api/downloads", { slug, quality });
      if (ac.signal.aborted) return;

      if (res.reused === true) {
        clearActiveDownload(slug);
        let fn: string | undefined;
        try {
          const st = await apiGet<JobStatusResponse>(`/api/downloads/${res.jobId}`);
          fn = st.filename;
        } catch {
          fn = undefined;
        }
        setDlUi({ mode: "ready", jobId: res.jobId, filename: fn });
        triggerSaveAsDownload(downloadFileUrl(res.jobId), fn);
        return;
      }

      saveActiveDownload(slug, res.jobId, startedAt);
      setDlUi({ mode: "working", jobId: res.jobId, serverStatus: "pending", startedAt });
      const result = await pollDownloadUntilTerminal(res.jobId, {
        signal: ac.signal,
        onStatus: (st) => {
          if (ac.signal.aborted) return;
          if (st.status === "pending" || st.status === "running") {
            const serverStatus = st.status === "running" ? "running" : "pending";
            setDlUi({ mode: "working", jobId: res.jobId, serverStatus, startedAt, queue: st.queue });
          }
        },
      });
      if (ac.signal.aborted) return;
      if (result === "done") {
        clearActiveDownload(slug);
        let fn: string | undefined;
        try {
          const st = await apiGet<JobStatusResponse>(`/api/downloads/${res.jobId}`);
          fn = st.filename;
        } catch {
          fn = undefined;
        }
        setDlUi({ mode: "ready", jobId: res.jobId, filename: fn });
        triggerSaveAsDownload(downloadFileUrl(res.jobId), fn);
        return;
      }
      if (result === "error") {
        clearActiveDownload(slug);
        try {
          const st = await apiGet<JobStatusResponse>(`/api/downloads/${res.jobId}`);
          setDlUi({ mode: "error", message: st.message || "下載失敗" });
        } catch {
          setDlUi({ mode: "error", message: "下載失敗" });
        }
        return;
      }
      if (result === "timeout") {
        clearActiveDownload(slug);
        setDlUi({ mode: "error", message: "等待逾時（超過 1 小時），請稍後重試或檢查伺服器暫存目錄。" });
      }
    } catch (e) {
      clearActiveDownload(slug);
      setDlUi({ mode: "error", message: e instanceof Error ? e.message : "下載失敗" });
    } finally {
      if (pollAbortRef.current === ac) pollAbortRef.current = null;
    }
  }

  if (loading) {
    return (
      <div className="page-shell detail-missav">
        <SiteHeader tone="detail" />
        <main className="detail-container">
          <Link className="back-link" to="/">
            ← 返回首頁
          </Link>
          <div className="detail-yt-grid detail-skeleton-grid">
            <div className="detail-yt-main">
              <div className="player-wrap player-missav skeleton" style={{ minHeight: "min(56vw, 480px)" }} />
            </div>
            <div className="detail-yt-sidebar detail-aside-card skeleton" style={{ minHeight: 200 }} />
          </div>
        </main>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="page-shell detail-missav">
        <SiteHeader tone="detail" />
        <main className="detail-container">
          <Link className="back-link" to="/">
            ← 返回首頁
          </Link>
          <div className="msg-error">{err || "無法載入"}</div>
          <p className="detail-footnote">
            請確認後端已啟動、Python 可 import missav_api，並已執行 <code className="inline-code">uv sync</code>。
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell detail-missav">
      <div className="detail-backdrop" style={{ backgroundImage: `url(${posterUrl})` }} aria-hidden />

      <SiteHeader tone="detail" />

      <main className="detail-container">
        <nav className="detail-breadcrumb detail-breadcrumb--bar" aria-label="麵包屑">
          <Link to="/">首頁</Link>
          <span aria-hidden> / </span>
          <span className="detail-breadcrumb-current">{data.video_code || data.slug}</span>
        </nav>

        <div className="detail-yt-grid">
          <div className="detail-yt-main">
            <div className="detail-player-stage">
              <div className="player-wrap player-missav player-elevated player-wrap--clickplay">
                <video ref={videoRef} controls playsInline poster={posterUrl} preload="none" />
                {!playbackStarted ? (
                  <button
                    type="button"
                    className="player-start-overlay"
                    onClick={() => {
                      const el = videoRef.current;
                      const raw = data.m3u8_play_url;
                      if (!el || !raw) return;
                      attachStreamAndPlayFromUserGesture(el, resolveMediaUrl(raw));
                      setPlaybackStarted(true);
                    }}
                    aria-label="開始播放影片"
                  >
                    <span className="player-start-icon" aria-hidden>
                      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.35)" />
                        <path d="M26 20L46 32L26 44V20Z" fill="white" />
                      </svg>
                    </span>
                    <span className="player-start-label">播放</span>
                  </button>
                ) : null}
                {playerErr ? (
                  <div className="player-error-banner" role="alert">
                    {playerErr}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="detail-title-row">
              <h1 className="detail-h1">{data.title}</h1>
              {favorited != null ? (
                <FavoriteHeart
                  slug={data.slug}
                  title={data.title}
                  initialFavorited={favorited}
                  className="detail-favorite-heart"
                  onAfterChange={(f) => setFavorited(f)}
                />
              ) : (
                <span className="detail-favorite-placeholder" aria-hidden />
              )}
            </div>

            <div className="detail-chips-row">
              {data.video_code ? <span className="chip chip-code">{data.video_code}</span> : null}
              {data.publish_date ? <span className="chip chip-muted">{data.publish_date}</span> : null}
              {data.manufacturer ? <span className="chip chip-outline">{data.manufacturer}</span> : null}
            </div>

            <p className="detail-player-note">
              按下「播放」後才會向本站載入串流（不會進頁就自動拉片）。播放經本站 HLS 代理；此頁不含第三方廣告或外站導流區塊。
            </p>

            <div className="detail-primary-below">
              {data.genres.length > 0 ? (
                <div className="detail-tags-block">
                  <h2 className="detail-section-label">類型</h2>
                  <div className="tag-row tag-row-missav">
                    {data.genres.map((g) => (
                      <Link
                        key={g}
                        to={`/search?q=${encodeURIComponent(g)}`}
                        className="tag tag-missav tag-missav-link"
                        title={`搜尋：${g}`}
                      >
                        {g}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="detail-meta-board">
                <h2 className="detail-section-label">詳細資料</h2>
                <dl className="meta-grid">
                  <dt>番號</dt>
                  <dd>{data.video_code}</dd>
                  <dt>發行日</dt>
                  <dd>{data.publish_date}</dd>
                  {data.title_original_japanese ? (
                    <>
                      <dt>日文標題</dt>
                      <dd>{data.title_original_japanese}</dd>
                    </>
                  ) : null}
                  {data.series ? (
                    <>
                      <dt>系列</dt>
                      <dd>{data.series}</dd>
                    </>
                  ) : null}
                  {data.manufacturer ? (
                    <>
                      <dt>廠牌</dt>
                      <dd>{data.manufacturer}</dd>
                    </>
                  ) : null}
                  {data.etiquette ? (
                    <>
                      <dt>其它</dt>
                      <dd>{data.etiquette}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            </div>
          </div>

          <aside className="detail-yt-sidebar detail-aside-card" id="download-panel" aria-busy={dlUi.mode === "working"}>
            <h2 className="detail-aside-title">下載</h2>
            <p className="detail-aside-desc">
              伺服器以 Python 合併為 MP4 後提供下載，與線上串流流程獨立。進入本頁會向伺服器查詢此番號是否<strong>已有完成檔</strong>（可重複下載、不會重複排隊）；處理中則自動續查進度。關閉分頁後仍可從伺服器辨識已完成檔（服務重啟或超過暫存時效後需重新合併）。
              {dlConcurrency != null ? (
                <>
                  {" "}
                  目前最多同時進行 <strong>{dlConcurrency}</strong> 個下載工作
                  {dlConcurrency === 1 ? "，其他請求會排隊。" : "。"}
                </>
              ) : null}
            </p>
            <button
              type="button"
              className="btn-primary btn-missav"
              disabled={dlUi.mode === "working"}
              onClick={() => void startDownload()}
            >
              {dlUi.mode === "working" ? "處理中…" : `下載 MP4（${quality}）`}
            </button>

            {dlUi.mode === "working" ? (
              <div className="dl-status-panel">
                <p className="dl-status-line">{downloadStatusLine(dlUi.serverStatus)}</p>
                {dlUi.jobId ? (
                  <p className="dl-status-meta">
                    已等待{" "}
                    {Math.max(0, Math.floor((Date.now() - dlUi.startedAt) / 1000) + 0 * dlTick)} 秒 · 工作編號{" "}
                    <code className="inline-code">{dlUi.jobId.slice(0, 8)}…</code>
                  </p>
                ) : (
                  <p className="dl-status-meta">
                    已等待 {Math.max(0, Math.floor((Date.now() - dlUi.startedAt) / 1000) + 0 * dlTick)} 秒 · 正在建立任務…
                  </p>
                )}
                {dlUi.queue ? (
                  <p className="dl-status-meta">
                    佇列：{dlUi.queue.runningJobs} 執行中／上限 {dlUi.queue.concurrency}，{dlUi.queue.pendingJobs} 筆等待中
                  </p>
                ) : null}
                <div className="download-progress-wrap" aria-hidden>
                  <div className="download-progress-indet" />
                </div>
                <p className="dl-status-hint">頁面每約 1.2 秒向伺服器查詢狀態；影片較長時可能需數分鐘。</p>
              </div>
            ) : null}

            {dlUi.mode === "ready" ? (
              <div className="dl-status-panel">
                <p className="dl-status-line">伺服器上已有此片的 MP4，可直接下載；再按上方「下載」也會沿用同一檔案、不會重跑合併。</p>
                <a
                  className="btn-primary btn-missav"
                  href={downloadFileUrl(dlUi.jobId)}
                  download={dlUi.filename}
                  style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}
                >
                  下載 MP4
                </a>
                <p className="dl-status-hint">
                  若按鈕無反應（例如 API 與前端不同網域且未開 CORS），請長按連結另存。完成檔暫存於伺服器，逾時後請重新排隊。
                </p>
              </div>
            ) : null}

            {dlUi.mode === "error" ? (
              <div className="dl-status-panel dl-status-panel--error" role="alert">
                <p className="dl-msg">{dlUi.message}</p>
                <button
                  type="button"
                  className="btn-secondary-missav"
                  onClick={() => {
                    clearActiveDownload(slug);
                    setDlUi({ mode: "idle" });
                  }}
                >
                  關閉並重試
                </button>
              </div>
            ) : null}

          </aside>
        </div>

        {related && related.length > 0 ? (
          <section className="detail-related" aria-labelledby="related-heading">
            <div className="detail-related-head">
              <h2 id="related-heading" className="detail-related-title">
                也可看看
              </h2>
              <p className="detail-related-sub">依本影片自動關聯（Recombee），無需手動挑番號</p>
            </div>
            <div className="grid-cards grid-cards-related">
              {related.map((it) => (
                <VideoCard key={`${it.id}-${locale}`} item={it} showFavoriteHeart />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
